import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/cooling_telemetry")

try:
    if "postgresql" in DATABASE_URL:
        # Create engine with a 3-second connection timeout
        engine = create_engine(DATABASE_URL, connect_args={"connect_timeout": 3})
    else:
        engine = create_engine(DATABASE_URL)
    # Test connection
    with engine.connect() as conn:
        pass
    print("Connected to PostgreSQL/TimescaleDB successfully.")
except Exception as e:
    print(f"PostgreSQL connection failed ({e}). Falling back to SQLite for local development.")
    db_dir = os.path.dirname(os.path.abspath(__file__))
    DATABASE_URL = f"sqlite:///{os.path.join(db_dir, 'cooling_telemetry.db')}"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
