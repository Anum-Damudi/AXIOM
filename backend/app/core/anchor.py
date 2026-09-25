import logging
from typing import Optional
from abc import ABC, abstractmethod
from app.core.config import settings

logger = logging.getLogger("axiom.anchor")

class LedgerAnchor(ABC):
    """Abstract interface for blockchain anchoring of ledger blocks."""
    
    @abstractmethod
    def anchor(self, block_hash: str, merkle_root: str) -> Optional[str]:
        """
        Anchor a block hash and merkle root to external blockchain.
        Returns transaction hash if successful, None otherwise.
        """
        pass

class NoopAnchor(LedgerAnchor):
    """No-op anchor that does nothing (default)."""
    
    def anchor(self, block_hash: str, merkle_root: str) -> Optional[str]:
        logger.debug(f"NoopAnchor: Would anchor block_hash={block_hash[:16]}..., merkle_root={merkle_root[:16]}...")
        return None

class EVMAnchor(LedgerAnchor):
    """EVM blockchain anchor using web3.py."""
    
    def __init__(self):
        try:
            from web3 import Web3
            self.web3 = Web3(Web3.HTTPProvider(settings.EVM_RPC_URL))
            self.contract_address = settings.EVM_CONTRACT_ADDRESS
            self.private_key = settings.EVM_PRIVATE_KEY
            
            # Load contract ABI (simplified for demo)
            self.contract_abi = [
                {
                    "inputs": [
                        {"name": "blockHash", "type": "bytes32"},
                        {"name": "merkleRoot", "type": "bytes32"}
                    ],
                    "name": "anchor",
                    "outputs": [{"name": "", "type": "bool"}],
                    "stateMutability": "nonpayable",
                    "type": "function"
                }
            ]
            
            if self.contract_address:
                self.contract = self.web3.eth.contract(
                    address=self.contract_address,
                    abi=self.contract_abi
                )
            else:
                self.contract = None
                
            logger.info("EVMAnchor initialized successfully")
        except ImportError:
            logger.warning("web3.py not installed, EVM anchoring disabled")
            self.web3 = None
            self.contract = None
        except Exception as e:
            logger.error(f"Failed to initialize EVMAnchor: {e}")
            self.web3 = None
            self.contract = None
    
    def anchor(self, block_hash: str, merkle_root: str) -> Optional[str]:
        if not self.web3 or not self.contract:
            logger.warning("EVMAnchor not properly initialized, skipping anchor")
            return None
        
        try:
            # Convert to bytes32
            block_hash_bytes = self.web3.to_bytes(hexstr=block_hash)
            merkle_root_bytes = self.web3.to_bytes(hexstr=merkle_root)
            
            # Build transaction
            tx_hash = self.contract.functions.anchor(
                block_hash_bytes,
                merkle_root_bytes
            ).transact({
                'from': self.web3.eth.account.from_key(self.private_key).address
            })
            
            # Wait for receipt
            receipt = self.web3.eth.wait_for_transaction_receipt(tx_hash)
            logger.info(f"Anchored block to EVM: tx_hash={receipt.transactionHash.hex()}")
            return receipt.transactionHash.hex()
        except Exception as e:
            logger.error(f"Failed to anchor to EVM: {e}")
            return None

def create_anchor() -> LedgerAnchor:
    """Factory function to create anchor based on ANCHOR_MODE."""
    mode = getattr(settings, 'ANCHOR_MODE', 'noop').lower()
    
    if mode == 'evm':
        return EVMAnchor()
    else:
        return NoopAnchor()
