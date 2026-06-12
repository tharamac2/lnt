
import requests

def test_store_login():
    url = "http://localhost:8000/users/token"
    # Using the credentials set by fix_store_user.py
    payload = {
        "username": "store",
        "password": "Admin@1234"
    }
    try:
        response = requests.post(url, data=payload)
        if response.status_code == 200:
            print("Login Successful!")
            print(response.json())
        else:
            print(f"Login Failed: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_store_login()
