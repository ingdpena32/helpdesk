"""
Ejemplos de uso de la conexión a PostgreSQL
"""

from database.connection import DatabaseConnection

def main():
    # Crear instancia de conexión
    db = DatabaseConnection()
    
    # Conectar a la base de datos
    if not db.connect():
        print("No se pudo establecer la conexión")
        return
    
    # Ejemplo 1: Consultar tablas existentes
    print("\n--- Tablas en la base de datos ---")
    query = """
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
    """
    tables = db.execute_query(query)
    if tables:
        for table in tables:
            print(f"  - {table[0]}")
    else:
        print("  No hay tablas en la base de datos")
    
    # Ejemplo 2: Crear una tabla de prueba
    print("\n--- Creando tabla de prueba ---")
    create_table_query = """
        CREATE TABLE IF NOT EXISTS tickets (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            status VARCHAR(50) DEFAULT 'open',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """
    db.execute_update(create_table_query)
    
    # Ejemplo 3: Insertar datos
    print("\n--- Insertando datos ---")
    insert_query = """
        INSERT INTO tickets (title, description, status)
        VALUES (%s, %s, %s)
    """
    params = ("Ticket de prueba", "Descripción del ticket", "open")
    db.execute_update(insert_query, params)
    
    # Ejemplo 4: Consultar datos
    print("\n--- Consultando datos ---")
    select_query = "SELECT id, title, status FROM tickets"
    results = db.execute_query(select_query)
    if results:
        for row in results:
            print(f"  ID: {row[0]}, Título: {row[1]}, Estado: {row[2]}")
    
    # Cerrar conexión
    db.disconnect()

if __name__ == "__main__":
    main()
