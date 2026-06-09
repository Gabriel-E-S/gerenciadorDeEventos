const mysql = require('mysql2/promise');
require('dotenv').config(); 

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 4000, 
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    
    ssl: {
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2'
    }
});

pool.getConnection()
    .then(connection => {
        console.log('Conectado ao MySQL com sucesso!');
        connection.release(); 
    })
    .catch(err => {
        console.error('Erro ao conectar no MySQL:', err.message);
    });

module.exports = pool;