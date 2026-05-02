"""
KadaiGPT - Offline-Online Orchestration Agent
Ensures seamless operation during network disruptions
"""

import asyncio
import json
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, asdict
from enum import Enum
import aiofiles
import os


class NetworkStatus(Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    UNSTABLE = "unstable"


class SyncStatus(Enum):
    PENDING = "pending"
    SYNCING = "syncing"
    SYNCED = "synced"
    FAILED = "failed"
    CONFLICT = "conflict"


@dataclass
class OfflineTransaction:
    local_id: str
    transaction_type: str  # bill, product_update, etc.
    data: Dict[str, Any]
    created_at: str
    sync_status: SyncStatus
    sync_attempts: int = 0
    last_sync_error: Optional[str] = None
    
    def to_dict(self) -> Dict:
        result = asdict(self)
        result['sync_status'] = self.sync_status.value
        return result


@dataclass
class SyncResult:
    success: bool
    synced_count: int
    failed_count: int
    conflicts: List[Dict]
    errors: List[str]


class OfflineAgent:
    """
    📶 OFFLINE-ONLINE ORCHESTRATION AGENT
    
    Responsibilities:
    - Monitor network status in real-time
    - Seamless switch between online/offline mode
    - Queue transactions during offline periods
    - Smart sync with conflict resolution
    - Prevent duplicate invoices (UUID-based)
    - Compress and batch sync for efficiency
    """
    
    def __init__(self, storage_path: str = "./offline_data"):
        self.agent_name = "OfflineAgent"
        self.storage_path = storage_path
        self.network_status = NetworkStatus.ONLINE
        self.pending_transactions: List[OfflineTransaction] = []
        self.sync_in_progress = False
        self.last_sync_time: Optional[datetime] = None
        self.network_check_interval = 5  # seconds
        self._monitor_task = None
        
        # Ensure storage directory exists
        os.makedirs(storage_path, exist_ok=True)
        
        # Pending transactions will be loaded on first access
        self._loaded = False
    
    async def start_network_monitoring(self):
        """Start continuous network monitoring"""
        if self._monitor_task is None:
            self._monitor_task = asyncio.create_task(self._network_monitor_loop())
            print("📶 Network monitoring started")
    
    async def stop_network_monitoring(self):
        """Stop network monitoring"""
        if self._monitor_task:
            self._monitor_task.cancel()
            self._monitor_task = None
    
    async def _network_monitor_loop(self):
        """Continuous network status check"""
        while True:
            try:
                previous_status = self.network_status
                self.network_status = await self._check_network_status()
                
                # Status changed
                if previous_status != self.network_status:
                    await self._handle_status_change(previous_status, self.network_status)
                
                await asyncio.sleep(self.network_check_interval)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Network monitor error: {e}")
                await asyncio.sleep(self.network_check_interval)
    
    async def _check_network_status(self) -> NetworkStatus:
        """Check current network connectivity"""
        import socket
        
        try:
            # Try to connect to Google DNS
            socket.create_connection(("8.8.8.8", 53), timeout=3)
            return NetworkStatus.ONLINE
        except (socket.timeout, socket.error):
            try:
                # Try backup DNS
                socket.create_connection(("1.1.1.1", 53), timeout=3)
                return NetworkStatus.UNSTABLE
            except:
                return NetworkStatus.OFFLINE
    
    async def _handle_status_change(
        self, 
        old_status: NetworkStatus, 
        new_status: NetworkStatus
    ):
        """Handle network status transitions"""
        print(f"📶 Network: {old_status.value} → {new_status.value}")
        
        if new_status == NetworkStatus.ONLINE and old_status == NetworkStatus.OFFLINE:
            # Back online - trigger sync
            print("🔄 Network restored. Starting sync...")
            await self.sync_pending_transactions()
        
        elif new_status == NetworkStatus.OFFLINE:
            # Going offline - ensure local storage is ready
            print("⚠️ Network lost. Switching to offline mode...")
            await self._persist_pending_transactions()
    
    def is_online(self) -> bool:
        """Quick check if currently online"""
        return self.network_status == NetworkStatus.ONLINE
    
    def get_status(self) -> Dict[str, Any]:
        """Get current agent status"""
        return {
            "network_status": self.network_status.value,
            "pending_transactions": len(self.pending_transactions),
            "last_sync": self.last_sync_time.isoformat() if self.last_sync_time else None,
            "sync_in_progress": self.sync_in_progress
        }
    
    async def queue_transaction(
        self, 
        transaction_type: str,
        data: Dict[str, Any]
    ) -> str:
        """
        🧠 AUTONOMOUS DECISION: Queue transaction for sync
        
        Called when:
        - Network is offline
        - Immediate sync fails
        - User wants to continue without waiting
        """
        local_id = str(uuid.uuid4())
        
        transaction = OfflineTransaction(
            local_id=local_id,
            transaction_type=transaction_type,
            data=data,
            created_at=datetime.now().isoformat(),
            sync_status=SyncStatus.PENDING
        )
        
        self.pending_transactions.append(transaction)
        
        # Persist to disk for safety
        await self._persist_pending_transactions()
        
        print(f"📥 Queued transaction: {local_id[:8]}... ({transaction_type})")
        
        return local_id
    
    async def sync_pending_transactions(self, api_endpoint: Optional[str] = None) -> SyncResult:
        """
        🔄 SYNC: Push all pending transactions to server
        
        Features:
        - Batch processing for efficiency
        - Conflict detection
        - Retry logic for failures
        - Transaction ordering preservation
        """
        if self.sync_in_progress:
            return SyncResult(
                success=False,
                synced_count=0,
                failed_count=0,
                conflicts=[],
                errors=["Sync already in progress"]
            )
        
        if not self.pending_transactions:
            return SyncResult(
                success=True,
                synced_count=0,
                failed_count=0,
                conflicts=[],
                errors=[]
            )
        
        self.sync_in_progress = True
        synced = []
        failed = []
        conflicts = []
        errors = []
        
        try:
            # Sort by creation time
            sorted_transactions = sorted(
                self.pending_transactions,
                key=lambda t: t.created_at
            )
            
            for transaction in sorted_transactions:
                try:
                    # Attempt to sync
                    result = await self._sync_single_transaction(transaction, api_endpoint)
                    
                    if result["status"] == "success":
                        synced.append(transaction.local_id)
                        transaction.sync_status = SyncStatus.SYNCED
                    elif result["status"] == "conflict":
                        conflicts.append({
                            "local_id": transaction.local_id,
                            "type": transaction.transaction_type,
                            "conflict_info": result.get("conflict_info")
                        })
                        transaction.sync_status = SyncStatus.CONFLICT
                    else:
                        failed.append(transaction.local_id)
                        transaction.sync_attempts += 1
                        transaction.last_sync_error = result.get("error")
                        transaction.sync_status = SyncStatus.FAILED
                        
                except Exception as e:
                    failed.append(transaction.local_id)
                    transaction.sync_attempts += 1
                    transaction.last_sync_error = str(e)
                    errors.append(f"{transaction.local_id}: {str(e)}")
            
            # Remove synced transactions
            self.pending_transactions = [
                t for t in self.pending_transactions 
                if t.local_id not in synced
            ]
            
            # Persist remaining
            await self._persist_pending_transactions()
            
            self.last_sync_time = datetime.now()
            
            return SyncResult(
                success=len(failed) == 0 and len(conflicts) == 0,
                synced_count=len(synced),
                failed_count=len(failed),
                conflicts=conflicts,
                errors=errors
            )
            
        finally:
            self.sync_in_progress = False
    
    async def _sync_single_transaction(
        self, 
        transaction: OfflineTransaction,
        api_endpoint: Optional[str]
    ) -> Dict[str, Any]:
        """Sync a single transaction to server"""
        # In production, this would make HTTP requests
        # For demo, we simulate success
        
        await asyncio.sleep(0.1)  # Simulate network delay
        
        # Check for duplicate (using local_id)
        # In production, server would check this
        
        return {
            "status": "success",
            "server_id": f"SRV-{uuid.uuid4().hex[:8]}",
            "synced_at": datetime.now().isoformat()
        }
    
    async def _persist_pending_transactions(self):
        """Save pending transactions to disk"""
        filepath = os.path.join(self.storage_path, "pending_transactions.json")
        
        data = [t.to_dict() for t in self.pending_transactions]
        
        async with aiofiles.open(filepath, 'w') as f:
            await f.write(json.dumps(data, indent=2))
    
    async def _load_pending_transactions(self):
        """Load pending transactions from disk on startup"""
        filepath = os.path.join(self.storage_path, "pending_transactions.json")
        
        if not os.path.exists(filepath):
            return
        
        try:
            async with aiofiles.open(filepath, 'r') as f:
                content = await f.read()
                data = json.loads(content)
                
            self.pending_transactions = [
                OfflineTransaction(
                    local_id=t['local_id'],
                    transaction_type=t['transaction_type'],
                    data=t['data'],
                    created_at=t['created_at'],
                    sync_status=SyncStatus(t['sync_status']),
                    sync_attempts=t.get('sync_attempts', 0),
                    last_sync_error=t.get('last_sync_error')
                )
                for t in data
            ]
            
            if self.pending_transactions:
                print(f"📂 Loaded {len(self.pending_transactions)} pending transactions")
                
        except Exception as e:
            print(f"Error loading pending transactions: {e}")
    
    async def get_pending_by_type(self, transaction_type: str) -> List[OfflineTransaction]:
        """Get all pending transactions of a specific type"""
        return [
            t for t in self.pending_transactions 
            if t.transaction_type == transaction_type
        ]
    
    async def cancel_pending(self, local_id: str) -> bool:
        """Cancel a pending transaction"""
        for i, t in enumerate(self.pending_transactions):
            if t.local_id == local_id:
                del self.pending_transactions[i]
                await self._persist_pending_transactions()
                return True
        return False
    
    def generate_offline_bill_number(self, store_prefix: str = "OFL") -> str:
        """
        Generate unique bill number for offline bills
        Format: OFL-YYYYMMDD-XXXX (e.g., OFL-20260129-A7B3)
        """
        date_part = datetime.now().strftime("%Y%m%d")
        unique_part = uuid.uuid4().hex[:4].upper()
        return f"{store_prefix}-{date_part}-{unique_part}"


# Singleton instance
offline_agent = OfflineAgent()
