import os
import psycopg2
from psycopg2 import sql, Error
from dotenv import load_dotenv

load_dotenv()

class DatabaseConnection:
    """Clase para manejar la conexión a PostgreSQL"""
    
    def __init__(self):
        self.host = os.getenv('DB_HOST', 'localhost')
        self.port = os.getenv('DB_PORT', '5432')
        self.database = os.getenv('DB_NAME', 'helpdesk')
        self.user = os.getenv('DB_USER', 'postgres')
        self.password = os.getenv('DB_PASSWORD', 'Nocturna5431+')
        self.connection = None
        self.cursor = None
    
    def connect(self):
        """Establece la conexión a la base de datos PostgreSQL"""
        try:
            self.connection = psycopg2.connect(
                host=self.host,
                port=self.port,
                database=self.database,
                user=self.user,
                password=self.password
            )
            self.cursor = self.connection.cursor()
            print(f"✓ Conexión exitosa a PostgreSQL - Base de datos: {self.database}")
            return True
        except Error as e:
            print(f"✗ Error al conectar a la base de datos: {e}")
            return False
    
    def disconnect(self):
        """Cierra la conexión a la base de datos"""
        if self.cursor:
            self.cursor.close()
        if self.connection:
            self.connection.close()
            print("✓ Conexión cerrada")
    
    def execute_query(self, query, params=None):
        """Ejecuta una consulta SELECT y retorna los resultados"""
        try:
            if params:
                self.cursor.execute(query, params)
            else:
                self.cursor.execute(query)
            return self.cursor.fetchall()
        except Error as e:
            print(f"✗ Error en la consulta: {e}")
            return None
    
    def execute_update(self, query, params=None):
        """Ejecuta INSERT, UPDATE o DELETE"""
        try:
            if params:
                self.cursor.execute(query, params)
            else:
                self.cursor.execute(query)
            self.connection.commit()
            print(f"✓ Operación realizada. Filas afectadas: {self.cursor.rowcount}")
            return True
        except Error as e:
            self.connection.rollback()
            print(f"✗ Error en la operación: {e}")
            return False
    
    def execute_script(self, script):
        """Ejecuta un script SQL con múltiples comandos"""
        try:
            self.cursor.execute(script)
            self.connection.commit()
            print("✓ Script ejecutado correctamente")
            return True
        except Error as e:
            self.connection.rollback()
            print(f"✗ Error al ejecutar script: {e}")
            return False
    
    def fetch_one(self):
        """Obtiene una fila de los resultados"""
        return self.cursor.fetchone()
    
    def fetch_all(self):
        """Obtiene todas las filas de los resultados"""
        return self.cursor.fetchall()
    
    def get_connection(self):
        """Retorna el objeto de conexión"""
        return self.connection
    
    def get_cursor(self):
        """Retorna el cursor"""
        return self.cursor
