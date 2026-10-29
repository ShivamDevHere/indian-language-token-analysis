"""benchmark_service.py - orchestrates benchmark runs.
TODO: for each model x language x test case (x repetitions): call model_service, measure latency,
price it with pricing_service, score it with safety_service, then save via database/db.py."""
