import React from 'react';
import { motion } from 'framer-motion';
import { Building2, Plane, School, Theater as Museum, Train, Landmark } from 'lucide-react';

const WhatIsMARG = () => {
  const venues = [
    { icon: Building2, name: 'Zoos & Safari Parks' },
    { icon: Plane, name: 'Airports' },
    { icon: School, name: 'Large Campuses' },
    { icon: Museum, name: 'Museums' },
    { icon: Train, name: 'Transit Hubs' },
    { icon: Landmark, name: 'Municipal Facilities' }
  ];

  return (
    <section id="what-is-marg" className="py-16 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold mb-6" style={{ color: '#2D5016' }}>
            Enterprise-Grade Offline-First Wayfinding
          </h2>
          <p className="text-xl text-gray-700 max-w-4xl mx-auto leading-relaxed">
            MARG is an enterprise-grade, offline-first digital wayfinding platform designed specifically for public infrastructure, large venues, and government deployments. Built to ensure seamless navigation and reliability even during low connectivity scenarios, MARG empowers organizations with complete control over their wayfinding infrastructure.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-12"
        >
          <h3 className="text-2xl font-semibold text-center mb-8" style={{ color: '#1E5A96' }}>
            Target Venues
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {venues.map((venue, index) => (
              <motion.div
                key={venue.name}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                whileHover={{ scale: 1.05, y: -5 }}
                className="bg-white rounded-xl p-6 shadow-lg hover:shadow-2xl transition-all text-center"
              >
                <venue.icon className="w-12 h-12 mx-auto mb-3" style={{ color: '#4A7C3C' }} />
                <p className="text-sm font-medium text-gray-800">{venue.name}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="bg-white rounded-xl p-8 shadow-xl"
          style={{ borderLeft: '4px solid #2D5016' }}
        >
          <h3 className="text-xl font-semibold mb-4" style={{ color: '#1E5A96' }}>
            Key Advantage
          </h3>
          <p className="text-lg text-gray-700 leading-relaxed">
            Unlike consumer navigation apps that require constant internet connectivity, MARG delivers seamless navigation experiences even in areas with limited or no network coverage. This makes it ideal for large public venues, remote facilities, and mission-critical applications where reliability is paramount.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default WhatIsMARG;