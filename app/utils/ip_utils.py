from flask import request
import ipaddress


ALLOWED_NETWORKS = [
    "192.168.1.0/24",
    "10.0.0.0/24",
    "127.0.0.1/32"
]


def get_client_ip():
    forwarded_for = request.headers.get("X-Forwarded-For")

    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    return request.remote_addr


def is_ip_allowed():
    client_ip = get_client_ip()

    try:
        ip_obj = ipaddress.ip_address(client_ip)

        for network in ALLOWED_NETWORKS:
            if ip_obj in ipaddress.ip_network(network, strict=False):
                return True

        return False

    except ValueError:
        return False