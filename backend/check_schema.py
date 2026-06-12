from sqlmodel import create_engine, text

# Database URL
mysql_url = "mysql+pymysql://root:@localhost/qr_tools_db"
engine = create_engine(mysql_url)

def describe_tool_table():
    with engine.connect() as connection:
        result = connection.execute(text("DESCRIBE tool"))
        print(f"{'Field':<20} {'Type':<20} {'Null':<10} {'Key':<10} {'Default':<10}")
        print("-" * 80)
        for row in result:
            print(f"{row[0]:<20} {row[1]:<20} {row[2]:<10} {row[3]:<10} {str(row[4]):<10}")

if __name__ == "__main__":
    describe_tool_table()
