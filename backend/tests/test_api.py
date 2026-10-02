def test_state_returns_default_settings_and_trips(client):
    response = client.get("/api/state")

    assert response.status_code == 200
    state = response.json()
    assert state["settings"] == {"consumption": 3.1, "fuel_price": 2.4}
    assert len(state["trips"]) == 3
    assert state["refuels"] == []


def test_settings_update_and_validation(client):
    response = client.put("/api/settings", json={"consumption": 4.2, "fuel_price": 2.1})

    assert response.status_code == 200
    assert response.json() == {"consumption": 4.2, "fuel_price": 2.1}
    assert client.put("/api/settings", json={"consumption": 0, "fuel_price": 2.1}).status_code == 422


def test_refuel_can_be_created_and_deleted(client):
    response = client.post(
        "/api/refuels",
        json={"date": "2026-10-02", "amount": 12.5, "price_per_liter": 1.89},
    )

    assert response.status_code == 200
    refuel_id = response.json()["id"]
    assert response.json()["amount"] == 12.5
    assert client.delete(f"/api/refuels/{refuel_id}").status_code == 200
    assert client.get("/api/state").json()["refuels"] == []