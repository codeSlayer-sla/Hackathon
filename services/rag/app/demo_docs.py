"""Bundled demo knowledge base so the RAG service answers real questions on day one,
independent of whatever mission/documents get assigned later.
"""

DEMO_DOCUMENTS: list[dict[str, str]] = [
    {
        "doc_id": "infra-001",
        "title": "Servidores de impresion",
        "text": (
            "La infraestructura de impresion de la empresa esta compuesta por dos "
            "servidores PaperCut en modo alta disponibilidad y un servidor MyQ para "
            "colas departamentales. Ambos sincronizan cuotas de usuario cada 15 minutos."
        ),
    },
    {
        "doc_id": "infra-002",
        "title": "Politica de acceso a documentacion interna",
        "text": (
            "La documentacion clasificada como 'internal' puede compartirse entre nodos "
            "QVAC autorizados de la empresa. La documentacion 'restricted' nunca sale del "
            "nodo de origen, incluso si un peer remoto esta disponible."
        ),
    },
    {
        "doc_id": "infra-003",
        "title": "Troubleshooting de red",
        "text": (
            "Ante fallas de conectividad entre nodos QVAC, primero se verifica el "
            "healthcheck del peer (GET /health) y luego su registro de capacidades "
            "en el Router antes de reintentar la inferencia delegada."
        ),
    },
    {
        "doc_id": "infra-004",
        "title": "Odoo y sistemas administrativos",
        "text": (
            "Odoo corre en un servidor separado de los nodos de inferencia QVAC. "
            "Los incidentes de Odoo se documentan en el sistema de tickets y son "
            "parte del conocimiento indexado por el RAG empresarial."
        ),
    },
]
