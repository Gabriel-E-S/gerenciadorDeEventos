import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

export default function Footer() {
    return (
        <footer className="footer">
            <h2>Venha fazer parte dessa história você também!</h2>

            <div className="footer-links">
                <Link to="/login" state={{ modoLogin: true }} className="btn-comecar">Vamos começar!</Link>
            </div>
        </footer>
    )

}
