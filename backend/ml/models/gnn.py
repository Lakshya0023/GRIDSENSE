"""
GridSense Graph Neural Network:
Multi-task Graph Attention Network (GAT) for node-level failure risk prediction,
time-to-critical regression, and peak loading prediction on electric power grids.
Implements spatial message passing natively in PyTorch.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Dict, Any, Optional

class GraphAttentionLayer(nn.Module):
    """
    Multi-head Graph Attention Layer with edge feature conditioning.
    Operates on sparse edge_index [2, E] and optional edge_attr [E, edge_dim].
    """
    def __init__(self, in_features: int, out_features: int, heads: int = 4, edge_dim: Optional[int] = None, dropout: float = 0.1):
        super().__init__()
        self.in_features = in_features
        self.out_features = out_features
        self.heads = heads
        self.head_dim = out_features // heads
        self.dropout = dropout

        self.lin_src = nn.Linear(in_features, out_features, bias=False)
        self.lin_dst = nn.Linear(in_features, out_features, bias=False)
        self.att_src = nn.Parameter(torch.Tensor(1, heads, self.head_dim))
        self.att_dst = nn.Parameter(torch.Tensor(1, heads, self.head_dim))
        
        if edge_dim is not None and edge_dim > 0:
            self.lin_edge = nn.Linear(edge_dim, out_features, bias=False)
        else:
            self.lin_edge = None

        self.bias = nn.Parameter(torch.Tensor(out_features))
        self.reset_parameters()

    def reset_parameters(self):
        nn.init.xavier_uniform_(self.lin_src.weight)
        nn.init.xavier_uniform_(self.lin_dst.weight)
        nn.init.xavier_uniform_(self.att_src)
        nn.init.xavier_uniform_(self.att_dst)
        nn.init.zeros_(self.bias)
        if self.lin_edge is not None:
            nn.init.xavier_uniform_(self.lin_edge.weight)

    def forward(self, x: torch.Tensor, edge_index: torch.Tensor, edge_attr: Optional[torch.Tensor] = None) -> torch.Tensor:
        num_nodes = x.size(0)
        h_src = self.lin_src(x).view(-1, self.heads, self.head_dim)
        h_dst = self.lin_dst(x).view(-1, self.heads, self.head_dim)

        if edge_index.numel() == 0:
            out = h_dst.view(-1, self.out_features) + self.bias
            return out

        src, dst = edge_index[0], edge_index[1]

        alpha_src = (h_src[src] * self.att_src).sum(dim=-1) # [E, heads]
        alpha_dst = (h_dst[dst] * self.att_dst).sum(dim=-1) # [E, heads]
        alpha = F.leaky_relu(alpha_src + alpha_dst, negative_slope=0.2)

        if self.lin_edge is not None and edge_attr is not None:
            edge_emb = self.lin_edge(edge_attr).view(-1, self.heads, self.head_dim)
            alpha = alpha + (edge_emb * self.att_src).sum(dim=-1)

        alpha_exp = torch.exp(alpha - alpha.max())
        denom = torch.zeros(num_nodes, self.heads, device=x.device).scatter_add(0, dst.unsqueeze(1).expand(-1, self.heads), alpha_exp) + 1e-12
        alpha_norm = alpha_exp / denom[dst]
        alpha_norm = F.dropout(alpha_norm, p=self.dropout, training=self.training)

        msg = h_src[src] * alpha_norm.unsqueeze(-1)
        out = torch.zeros(num_nodes, self.heads, self.head_dim, device=x.device)
        dst_expanded = dst.unsqueeze(1).unsqueeze(2).expand(-1, self.heads, self.head_dim)
        out.scatter_add_(0, dst_expanded, msg)

        out = out.view(num_nodes, self.out_features) + self.bias
        return out


class GridSenseGNN(nn.Module):
    def __init__(
        self,
        in_channels: int = 14,
        hidden_channels: int = 64,
        edge_dim: int = 3,
        heads: int = 4,
        dropout: float = 0.1
    ):
        """
        GNN Architecture for Power Grids:
        Input node features (14 features from authoritative dataset:
          f_load_pct, f_temp_c, f_voltage_pu_proxy, f_capacity_mva, f_age_years,
          f_demand_mw, f_gen_mw, f_degree, f_ambient_c, f_headroom_pct,
          f_stress_multiplier, f_load_multiplier, f_weather_factor, f_hops_from_initiator)
        -> Linear projection + LayerNorm
        -> Multi-head GATConv Layer 1 (with edge features) + ReLU + Dropout
        -> Multi-head GATConv Layer 2 + ReLU + Dropout
        -> Multi-head GATConv Layer 3 (node embeddings)
        -> Multi-task Heads:
           1. Risk classification head (BCE): P(failure in next 3 steps)
           2. Time-to-critical regression head: steps remaining
           3. Peak loading regression head: max loading %
        """
        super().__init__()
        self.in_channels = in_channels
        self.dropout = dropout

        self.node_proj = nn.Linear(in_channels, hidden_channels)
        self.norm0 = nn.LayerNorm(hidden_channels)

        self.conv1 = GraphAttentionLayer(
            in_features=hidden_channels,
            out_features=hidden_channels,
            heads=heads,
            edge_dim=edge_dim,
            dropout=dropout
        )
        self.norm1 = nn.LayerNorm(hidden_channels)

        self.conv2 = GraphAttentionLayer(
            in_features=hidden_channels,
            out_features=hidden_channels,
            heads=heads,
            edge_dim=edge_dim,
            dropout=dropout
        )
        self.norm2 = nn.LayerNorm(hidden_channels)

        self.conv3 = GraphAttentionLayer(
            in_features=hidden_channels,
            out_features=hidden_channels,
            heads=heads,
            edge_dim=edge_dim,
            dropout=dropout
        )
        self.norm3 = nn.LayerNorm(hidden_channels)

        self.risk_head = nn.Sequential(
            nn.Linear(hidden_channels, 32),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(32, 1)
        )

        self.time_head = nn.Sequential(
            nn.Linear(hidden_channels, 32),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(32, 1),
            nn.Softplus()
        )

        self.peak_load_head = nn.Sequential(
            nn.Linear(hidden_channels, 32),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(32, 1)
        )

    def forward(self, x: torch.Tensor, edge_index: torch.Tensor, edge_attr: Optional[torch.Tensor] = None) -> Dict[str, torch.Tensor]:
        if x.dim() == 1:
            x = x.unsqueeze(0)
        if x.size(-1) != self.in_channels:
            if x.size(-1) < self.in_channels:
                pad = torch.zeros(x.size(0), self.in_channels - x.size(-1), device=x.device)
                x = torch.cat([x, pad], dim=-1)
            else:
                x = x[:, :self.in_channels]

        h = self.node_proj(x)
        h = self.norm0(h)
        h = F.relu(h)

        h_res = h
        h = self.conv1(h, edge_index, edge_attr=edge_attr)
        h = self.norm1(h)
        h = F.relu(h) + h_res
        h = F.dropout(h, p=self.dropout, training=self.training)

        h_res = h
        h = self.conv2(h, edge_index, edge_attr=edge_attr)
        h = self.norm2(h)
        h = F.relu(h) + h_res
        h = F.dropout(h, p=self.dropout, training=self.training)

        h_res = h
        h = self.conv3(h, edge_index, edge_attr=edge_attr)
        h = self.norm3(h)
        h = F.relu(h) + h_res

        risk_logits = self.risk_head(h).squeeze(-1)
        time_to_crit = self.time_head(h).squeeze(-1)
        peak_loading = self.peak_load_head(h).squeeze(-1)

        return {
            "risk_logits": risk_logits,
            "risk_prob": torch.sigmoid(risk_logits),
            "time_to_critical": time_to_crit,
            "peak_loading": peak_loading,
            "node_embeddings": h
        }

