"""
KadaiGPT - AI Agents Package
"""

from .core import (
    BaseAgent,
    AgentTool,
    AgentGoal,
    AgentOrchestrator,
    StoreManagerAgent,
    InventoryAgent,
    CustomerEngagementAgent
)

# Import agent instances
from .print_agent import print_agent
from .inventory_agent import inventory_agent
from .offline_agent import offline_agent

__all__ = [
    "BaseAgent",
    "AgentTool", 
    "AgentGoal",
    "AgentOrchestrator",
    "StoreManagerAgent",
    "InventoryAgent",
    "CustomerEngagementAgent",
    # Agent instances
    "print_agent",
    "inventory_agent", 
    "offline_agent"
]
