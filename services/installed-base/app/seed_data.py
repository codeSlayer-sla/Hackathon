"""The 20 fictional observations from the Philips hackathon dummy dataset
(`Dummy_Installed_Base_Hackathon.xlsx`, sheet "Dummy Installed Base"). That
sheet's own README says it's meant as "database seed" -- loaded once, on
first startup, if the store is empty, so the Customer 360 / analytics views
show real data on day one instead of an empty screen.
"""

SEED_OBSERVATIONS: list[dict] = [
    {
        "customer": "Hospital DemoCare Pacific", "country": "Panama", "city": "Panama City",
        "modality": "MR", "quantity": 2, "brand": "NovaMed", "model": "NM-MR 700",
        "approx_age_years": 7, "estimated_install_year": 2019, "confidence": "high",
        "status": "reported", "observer": "Field User 01", "visit_date": "2026-08-18",
        "notes": "Two MR systems observed in imaging area.",
    },
    {
        "customer": "Hospital DemoCare Pacific", "country": "Panama", "city": "Panama City",
        "modality": "CT", "quantity": 1, "brand": "Aurelia Health", "model": "AH-CT 320",
        "approx_age_years": 5, "estimated_install_year": 2021, "confidence": "high",
        "status": "reported", "observer": "Field User 01", "visit_date": "2026-08-18",
        "notes": "Single CT system observed.",
    },
    {
        "customer": "Hospital DemoCare Horizon", "country": "Brazil", "city": "Sao Paulo",
        "modality": "MR", "quantity": 3, "brand": "BluePeak Medical", "model": "BP-MR 500",
        "approx_age_years": 9, "estimated_install_year": 2017, "confidence": "medium",
        "status": "estimated", "observer": "Sales User 02", "visit_date": "2026-08-16",
        "notes": "Aggregate row for older systems.",
    },
    {
        "customer": "Hospital DemoCare Horizon", "country": "Brazil", "city": "Sao Paulo",
        "modality": "MR", "quantity": 1, "brand": "BluePeak Medical", "model": "BP-MR 900",
        "approx_age_years": 3, "estimated_install_year": 2023, "confidence": "medium",
        "status": "estimated", "observer": "Sales User 02", "visit_date": "2026-08-16",
        "notes": "Newer MR system.",
    },
    {
        "customer": "Clinica DemoCare Light", "country": "Brazil", "city": "Campinas",
        "modality": "CT", "quantity": 2, "brand": "Orion Imaging", "model": "OI-CT 450",
        "approx_age_years": 11, "estimated_install_year": 2015, "confidence": "high",
        "status": "reported", "observer": "Field User 03", "visit_date": "2026-08-15",
        "notes": "Potential aging installed base.",
    },
    {
        "customer": "Clinica DemoCare Light", "country": "Brazil", "city": "Campinas",
        "modality": "Ultrasound", "quantity": 5, "brand": "HelixCare", "model": "HC-US 40",
        "approx_age_years": 4, "estimated_install_year": 2022, "confidence": "medium",
        "status": "reported", "observer": "Field User 03", "visit_date": "2026-08-15",
        "notes": "Four confirmed, one uncertain.",
    },
    {
        "customer": "Centro Medico DemoCare Valley", "country": "Mexico", "city": "Mexico City",
        "modality": "MR", "quantity": 1, "brand": "Zenith MedTech", "model": "ZM-MR 810",
        "approx_age_years": 6, "estimated_install_year": 2020, "confidence": "high",
        "status": "reported", "observer": "Account User 04", "visit_date": "2026-08-14",
        "notes": "MR observation.",
    },
    {
        "customer": "Centro Medico DemoCare Valley", "country": "Mexico", "city": "Mexico City",
        "modality": "CT", "quantity": 2, "brand": "Aurelia Health", "model": "AH-CT 510",
        "approx_age_years": 8, "estimated_install_year": 2018, "confidence": "medium",
        "status": "estimated", "observer": "Account User 04", "visit_date": "2026-08-14",
        "notes": "Two similar CT units.",
    },
    {
        "customer": "Hospital DemoCare North", "country": "Mexico", "city": "Monterrey",
        "modality": "Ultrasound", "quantity": 6, "brand": "NovaMed", "model": "NM-US 55",
        "approx_age_years": 2, "estimated_install_year": 2024, "confidence": "high",
        "status": "reported", "observer": "Field User 05", "visit_date": "2026-08-13",
        "notes": "Recent installation.",
    },
    {
        "customer": "Clinica DemoCare Andes", "country": "Chile", "city": "Santiago",
        "modality": "CT", "quantity": 1, "brand": "BluePeak Medical", "model": "BP-CT 610",
        "approx_age_years": 13, "estimated_install_year": 2013, "confidence": "medium",
        "status": "estimated", "observer": "Sales User 06", "visit_date": "2026-08-12",
        "notes": "Old CT estimate.",
    },
    {
        "customer": "Clinica DemoCare Andes", "country": "Chile", "city": "Santiago",
        "modality": "MR", "quantity": 2, "brand": "Orion Imaging", "model": "OI-MR 620",
        "approx_age_years": 5, "estimated_install_year": 2021, "confidence": "high",
        "status": "reported", "observer": "Sales User 06", "visit_date": "2026-08-12",
        "notes": "Two MR units.",
    },
    {
        "customer": "Hospital DemoCare Park", "country": "Argentina", "city": "Buenos Aires",
        "modality": "MR", "quantity": 1, "brand": "HelixCare", "model": "HC-MR 300",
        "approx_age_years": 10, "estimated_install_year": 2016, "confidence": "medium",
        "status": "reported", "observer": "Field User 07", "visit_date": "2026-08-11",
        "notes": "Model not visible.",
    },
    {
        "customer": "Hospital DemoCare Park", "country": "Argentina", "city": "Buenos Aires",
        "modality": "CT", "quantity": 3, "brand": "Zenith MedTech", "model": "ZM-CT 430",
        "approx_age_years": 7, "estimated_install_year": 2019, "confidence": "high",
        "status": "reported", "observer": "Field User 07", "visit_date": "2026-08-11",
        "notes": "Three CT units.",
    },
    {
        "customer": "Clinica DemoCare Central", "country": "Colombia", "city": "Bogota",
        "modality": "Ultrasound", "quantity": 8, "brand": "Aurelia Health", "model": "AH-US 70",
        "approx_age_years": 6, "estimated_install_year": 2020, "confidence": "medium",
        "status": "estimated", "observer": "Account User 08", "visit_date": "2026-08-10",
        "notes": "Quantity estimated.",
    },
    {
        "customer": "Hospital DemoCare Pines", "country": "Colombia", "city": "Medellin",
        "modality": "MR", "quantity": 2, "brand": "NovaMed", "model": "NM-MR 720",
        "approx_age_years": 4, "estimated_install_year": 2022, "confidence": "high",
        "status": "reported", "observer": "Field User 09", "visit_date": "2026-08-09",
        "notes": "Two MR systems.",
    },
    {
        "customer": "Instituto DemoCare Lima", "country": "Peru", "city": "Lima",
        "modality": "CT", "quantity": 2, "brand": "Orion Imaging", "model": "OI-CT 540",
        "approx_age_years": 12, "estimated_install_year": 2014, "confidence": "medium",
        "status": "estimated", "observer": "Sales User 10", "visit_date": "2026-08-08",
        "notes": "Potential refresh opportunity.",
    },
    {
        "customer": "Instituto DemoCare Lima", "country": "Peru", "city": "Lima",
        "modality": "MR", "quantity": 1, "brand": "BluePeak Medical", "model": "BP-MR 840",
        "approx_age_years": 2, "estimated_install_year": 2024, "confidence": "high",
        "status": "reported", "observer": "Sales User 10", "visit_date": "2026-08-08",
        "notes": "Recent MR.",
    },
    {
        "customer": "Hospital DemoCare Green", "country": "Costa Rica", "city": "San Jose",
        "modality": "Ultrasound", "quantity": 4, "brand": "HelixCare", "model": "HC-US 60",
        "approx_age_years": 9, "estimated_install_year": 2017, "confidence": "medium",
        "status": "reported", "observer": "Field User 11", "visit_date": "2026-08-07",
        "notes": "Same family.",
    },
    {
        "customer": "Centro Diagnostico DemoCare Caribbean", "country": "Dominican Republic",
        "city": "Santo Domingo", "modality": "CT", "quantity": 1, "brand": "Zenith MedTech",
        "model": "ZM-CT 760", "approx_age_years": 3, "estimated_install_year": 2023,
        "confidence": "high", "status": "reported", "observer": "Account User 12",
        "visit_date": "2026-08-06", "notes": "Newer CT.",
    },
    {
        "customer": "Hospital DemoCare Metro North", "country": "Ecuador", "city": "Quito",
        "modality": "MR", "quantity": 2, "brand": "Aurelia Health", "model": "AH-MR 650",
        "approx_age_years": 8, "estimated_install_year": 2018, "confidence": "medium",
        "status": "estimated", "observer": "Field User 13", "visit_date": "2026-08-05",
        "notes": "Model unknown.",
    },
]
