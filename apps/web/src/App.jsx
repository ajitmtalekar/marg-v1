import React from 'react';
import { Helmet } from 'react-helmet';
import Header from './components/Header';
import Hero from './components/Hero';
import WhatIsMARG from './components/WhatIsMARG';
import KeyDifferentiators from './components/KeyDifferentiators';
import ProductFeatures from './components/ProductFeatures';
import TargetIndustries from './components/TargetIndustries';
import ComparisonTable from './components/ComparisonTable';
import LockInMitigation from './components/LockInMitigation';
import VendorLockInRisks from './components/VendorLockInRisks';
import DeploymentModel from './components/DeploymentModel';
import Footer from './components/Footer';
import { Toaster } from './components/ui/toaster';

function App() {
  return (
    <>
      <Helmet>
        <title>MARG - Enterprise-Grade Offline-First Wayfinding Platform</title>
        <meta 
          name="description" 
          content="MARG is an enterprise-grade, offline-first digital wayfinding platform for public infrastructure, large venues, and government deployments. Reliable navigation with absolute control." 
        />
      </Helmet>
      
      <div className="min-h-screen bg-white" style={{ scrollBehavior: 'smooth' }}>
        <Header />
        <main>
          <Hero />
          <WhatIsMARG />
          <KeyDifferentiators />
          <ProductFeatures />
          <TargetIndustries />
          <ComparisonTable />
          <LockInMitigation />
          <VendorLockInRisks />
          <DeploymentModel />
        </main>
        <Footer />
        <Toaster />
      </div>
    </>
  );
}

export default App;