from sqlmodel import Session, select
from backend.database import engine
from backend.models import Tool
from datetime import datetime


def fix_tool_validity():
    with Session(engine) as session:
        statement = select(Tool)
        tools = session.exec(statement).all()
        
        count = 0
        for tool in tools:
            if tool.date_of_supply:
                # Calculate expiry date: date_of_supply + 3 years (approx 365*3 days)
                # To be exact with leap years we can try/except or just replace year
                try:
                    expiry_date = tool.date_of_supply.replace(year=tool.date_of_supply.year + 3)
                except ValueError:
                    # Handles Feb 29 (leap year) -> adjust to Feb 28 or Mar 1
                    expiry_date = tool.date_of_supply.replace(year=tool.date_of_supply.year + 3, day=28)
                
                tool.expiry_date = expiry_date
                tool.validity_period = 3
                session.add(tool)
                count += 1
                print(f"Updated Tool ID {tool.id}: Supply {tool.date_of_supply.date()} -> Expiry {expiry_date.date()}")
            else:
                print(f"Skipping Tool ID {tool.id}: No Date of Supply")
        
        session.commit()
        print(f"\nSuccessfully updated {count} tools.")

if __name__ == "__main__":
    fix_tool_validity()
