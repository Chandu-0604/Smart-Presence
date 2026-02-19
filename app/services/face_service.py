from datetime import datetime
import cv2
import numpy as np
from deepface import DeepFace
from app.extensions import db
from app.utils.encryption import encrypt_vector, decrypt_vector
from flask import current_app
from app.utils.logger import log_event
# LOAD MODEL ONCE (GLOBAL)
FACE_MODEL = DeepFace.build_model("Facenet512")
# -----------------------------
# EMBEDDING GENERATION
# -----------------------------

def generate_embedding(image):
    """
    image: numpy array (BGR from OpenCV)
    """

    try:
        # convert BGR → RGB
        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        # resize to FaceNet expected size
        rgb = cv2.resize(rgb, (160, 160))

        # normalize pixel values to [0,1]
        rgb = rgb.astype("float32") / 255.0

        # DeepFace embedding (no detection, no alignment)
        representation = DeepFace.represent(
            img_path=rgb,
            model_name="Facenet512",
            enforce_detection=False,
            detector_backend="skip",
            align=False,
            normalization="base"
        )


        if not representation:
            return None

        embedding = np.array(representation[0]["embedding"], dtype="float32")
        return embedding

    except Exception as e:
        print("Embedding error:", e)
        return None

# -----------------------------
# AVERAGING MULTIPLE CAPTURES
# -----------------------------

def average_embeddings(embeddings):
    return np.mean(embeddings, axis=0)


# -----------------------------
# COSINE SIMILARITY
# -----------------------------

def cosine_similarity(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))


# -----------------------------
# FACE REGISTRATION
# -----------------------------

def register_face(user, images):

    embeddings = []

    for image in images:

        # ---------- QUALITY CHECK ----------
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        # blur detection (reject motion blur)
        blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()
        if blur_score < 5:
            continue

        # brightness check (reject dark frames)
        brightness = gray.mean()
        if brightness < 30:
            continue

        # ---------- EMBEDDING ----------
        emb = generate_embedding(image)

        if emb is not None:
            embeddings.append(emb)

    # require minimum valid samples
    if len(embeddings) < 2:
        return False, "Face not clear. Please register again in good lighting."

    # ---------- AVERAGE ----------
    avg_embedding = average_embeddings(embeddings)

    # ---------- NORMALIZE (CRITICAL FIX) ----------
    norm = np.linalg.norm(avg_embedding)
    if norm == 0:
        return False, "Face processing error. Try again."

    avg_embedding = avg_embedding / norm

    # ---------- ENCRYPT ----------
    encrypted = encrypt_vector(avg_embedding.astype("float32"))

    # ---------- SAVE ----------
    user.face_embedding = encrypted
    user.face_registered = True
    user.embedding_updated_at = datetime.utcnow()

    # reset biometric violations after fresh enrollment
    user.biometric_violations = 0

    db.session.commit()

    return True, "Face registered successfully"

# -----------------------------
# FACE VERIFICATION
# -----------------------------

def verify_face(input_image, candidate_users):

    threshold = current_app.config.get("FACE_MIN_SIMILARITY", 0.80)

    input_embedding = generate_embedding(input_image)

    if input_embedding is None:
        return None, 0.0

    # Normalize input embedding
    norm = np.linalg.norm(input_embedding)
    if norm == 0:
        return None, 0.0
    input_embedding = input_embedding / norm

    best_user = None
    best_score = 0.0

    for user in candidate_users:

        if not user.face_embedding:
            continue

        try:
            stored_embedding = decrypt_vector(user.face_embedding)
            norm = np.linalg.norm(stored_embedding)
            if norm == 0:
                continue
            stored_embedding = stored_embedding / norm

        except Exception:
            log_event(f"Embedding decryption failed for user {user.id}")
            continue

        score = float(np.dot(input_embedding, stored_embedding))
        print("SIMILARITY SCORE:", score)

        if score > best_score:
            best_score = score
            best_user = user

    if best_score >= threshold:
        return best_user, best_score

    log_event(f"Face verification failed. Best similarity: {best_score}")

    return None, best_score