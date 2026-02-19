import cv2
import numpy as np


def detect_liveness(image):
    """
    Robust liveness detection for real classroom environments
    Returns: (is_live, reason)
    """

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    suspicion = 0
    reasons = []

    # 1️⃣ Brightness (screens too uniform)
    brightness = np.mean(gray)
    if brightness > 240:
        suspicion += 2
        reasons.append("Overexposed screen")

    # 2️⃣ Focus / depth (printed photos very flat)
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    if laplacian_var < 8:
        suspicion += 2
        reasons.append("Flat surface detected")

    # 3️⃣ Texture variation (real skin has micro variation)
    blur = cv2.GaussianBlur(gray, (7,7), 0)
    diff = cv2.absdiff(gray, blur)
    texture = np.mean(diff)

    if texture < 1.2:
        suspicion += 2
        reasons.append("Low texture")

    # 4️⃣ Edge density (phone screens create hard borders)
    edges = cv2.Canny(gray, 80, 120)
    edge_ratio = np.sum(edges > 0) / edges.size

    if edge_ratio > 0.38:
        suspicion += 2
        reasons.append("Screen edges detected")

    # 5️⃣ Micro noise (real cameras have sensor noise)
    noise = np.std(gray)
    if noise < 4:
        suspicion += 1
        reasons.append("Digital display suspected")

    # FINAL DECISION
    if suspicion >= 4:
        return False, ", ".join(reasons)

    return True, "Live face"