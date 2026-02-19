from cryptography.fernet import Fernet
from flask import current_app
import numpy as np


def get_cipher():
    key = current_app.config["FACE_ENCRYPTION_KEY"]
    return Fernet(key.encode())


def encrypt_vector(vector: np.ndarray) -> bytes:
    cipher = get_cipher()
    return cipher.encrypt(vector.astype("float64").tobytes())


def decrypt_vector(encrypted: bytes) -> np.ndarray:
    cipher = get_cipher()
    decrypted = cipher.decrypt(encrypted)
    return np.frombuffer(decrypted, dtype="float64")