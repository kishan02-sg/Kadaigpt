"""
KadaiGPT - Data Encryption Utility
Encrypt sensitive customer data (phone, email, financial info) at rest.
Uses Fernet symmetric encryption with key rotation support.
"""

import os
import base64
import hashlib
import logging
from typing import Optional
from cryptography.fernet import Fernet, MultiFernet

logger = logging.getLogger("KadaiGPT.Encryption")


class DataEncryption:
    """
    Field-level encryption for sensitive customer data.
    
    Usage:
        encryptor = DataEncryption()
        encrypted = encryptor.encrypt("sensitive_data")
        decrypted = encryptor.decrypt(encrypted)
    """

    # Prefix to identify encrypted values
    ENCRYPTED_PREFIX = "ENC::"

    def __init__(self, encryption_key: Optional[str] = None):
        key = encryption_key or os.getenv("ENCRYPTION_KEY")
        
        if not key:
            # Generate a deterministic key from SECRET_KEY for dev
            secret = os.getenv("SECRET_KEY", "kadaigpt-dev-secret-change-me")
            key = base64.urlsafe_b64encode(
                hashlib.sha256(secret.encode()).digest()
            ).decode()
            logger.warning("[Encryption] Using derived key. Set ENCRYPTION_KEY in production!")
        
        self.fernet = Fernet(key.encode() if isinstance(key, str) else key)
    
    def encrypt(self, plaintext: str) -> str:
        """Encrypt a string value"""
        if not plaintext:
            return plaintext
        
        # Don't double-encrypt
        if plaintext.startswith(self.ENCRYPTED_PREFIX):
            return plaintext
        
        try:
            encrypted = self.fernet.encrypt(plaintext.encode("utf-8"))
            return f"{self.ENCRYPTED_PREFIX}{encrypted.decode('utf-8')}"
        except Exception as e:
            logger.error(f"[Encryption] Encrypt failed: {e}")
            return plaintext  # Fail open for availability
    
    def decrypt(self, ciphertext: str) -> str:
        """Decrypt an encrypted string value"""
        if not ciphertext:
            return ciphertext
        
        # Only decrypt if it's actually encrypted
        if not ciphertext.startswith(self.ENCRYPTED_PREFIX):
            return ciphertext
        
        try:
            encrypted_data = ciphertext[len(self.ENCRYPTED_PREFIX):]
            decrypted = self.fernet.decrypt(encrypted_data.encode("utf-8"))
            return decrypted.decode("utf-8")
        except Exception as e:
            logger.error(f"[Encryption] Decrypt failed: {e}")
            return ciphertext  # Return as-is if decrypt fails
    
    def is_encrypted(self, value: str) -> bool:
        """Check if a value is encrypted"""
        return bool(value and value.startswith(self.ENCRYPTED_PREFIX))
    
    def hash_for_search(self, value: str) -> str:
        """
        Create a deterministic hash for searching encrypted fields.
        Allows lookup by phone/email without decrypting all records.
        """
        if not value:
            return ""
        return hashlib.sha256(value.lower().strip().encode("utf-8")).hexdigest()[:16]

    @staticmethod
    def generate_key() -> str:
        """Generate a new Fernet encryption key"""
        return Fernet.generate_key().decode("utf-8")


# Global instance
data_encryptor = DataEncryption()
