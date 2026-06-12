from sqlmodel import Session, select, delete
from backend.database import engine
from backend.models import User

def cleanup_users():
    with Session(engine) as session:
        # Define roles/usernames to keep
        # We keep 'admin' (Madhavan), 'inspector', 'store', 'management'
        # We will delete 'worker' or any random users
        
        # Get all users
        users = session.exec(select(User)).all()
        
        print("Current Users:")
        for u in users:
            print(f"- {u.username} ({u.role})") # email/username might be same
            
        print("\nCleaning up...")
        
        allowed_roles = ['admin', 'inspector', 'store', 'management']
        # Also strictly keep 'Madhavan' if he is the admin
        
        count = 0
        for user in users:
            # Check if user is essential
            is_essential = False
            
            if user.role in allowed_roles:
                # Keep one per role if multiple? Or just keep all with valid roles?
                # The user said "4 users", implying 1 per role.
                # Let's keep specific usernames if they exist to be safe, or just roles.
                # Let's keep 'Madhavan' (admin), 'inspector', 'store', 'management'
                if user.username in ['Madhavan', 'inspector', 'store', 'management']:
                    is_essential = True
                elif user.role == 'admin': # Keep any admin just in case
                     is_essential = True
            
            if not is_essential:
                print(f"Deleting user: {user.username} ({user.role})")
                session.delete(user)
                count += 1
            else:
                print(f"Keeping user: {user.username} ({user.role})")

        session.commit()
        print(f"\nDeleted {count} users.")
        
        # Verify
        remaining = session.exec(select(User)).all()
        print("\nRemaining Users:")
        for u in remaining:
            print(f"- {u.username} ({u.role})")

if __name__ == "__main__":
    cleanup_users()
