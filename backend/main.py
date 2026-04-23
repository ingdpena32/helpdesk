from database.connection import DatabaseConnection

def main():
    # Crear instancia de conexión
    db = DatabaseConnection()
    
    # Conectar a la base de datos
    if not db.connect():
        print("No se pudo establecer la conexión")
        return
    
    # Verificar la conexión
    try:
        result = db.execute_query("SELECT 1")
        if result:
            print(f"\n✓ Conexión verificada exitosamente")
            print(f"  Host: {db.host}")
            print(f"  Puerto: {db.port}")
            print(f"  Base de datos: {db.database}")
            print(f"  Usuario: {db.user}")
    except Exception as e:
        print(f"✗ Error: {e}")
    finally:
        db.disconnect()

if __name__ == "__main__":
    main()
