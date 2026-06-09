import React from 'react';
import Hero from '../../components/Layout/Hero';
import Features from '../../components/Home/Features';
import Events from '../../components/Home/Events';
import Footer from '../../components/Layout/Footer';

export default function Home() {
  return (
    <>
      <Hero />
      <Features />
      <Events />
      <Footer />
    </>
  );
}