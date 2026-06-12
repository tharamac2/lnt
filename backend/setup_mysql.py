import pymysql
import getpass

def create_database():
    print("=== MySQL Database Setup ===")
    host = input("MySQL Host (default: localhost): ") or "localhost"
    user = input("MySQL User (default: root): ") or "root"
    password = getpass.getpass("MySQL Password: ")
    port = input("MySQL Port (default: 3306): ") or "3306"
    
    db_name = "qr_tools_db"

    try:
        # Connect to MySQL Server (no DB selected yet)
        connection = pymysql.connect(
            host=host,
            user=user,
            password=password,
            port=int(port),
            cursorclass=pymysql.cursors.DictCursor
        )
        
        with connection.cursor() as cursor:
            print(f"Creating database '{db_name}' if it doesn't exist...")
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS {db_name}")
            print(f"✅ Database '{db_name}' created successfully!")
            
        connection.commit()
    except Exception as e:
        print(f"❌ Error: {e}")
        print("Please check your password and ensure MySQL server is running.")
    finally:
        if 'connection' in locals() and connection.open:
            connection.close()

if __name__ == "__main__":
    create_database()
