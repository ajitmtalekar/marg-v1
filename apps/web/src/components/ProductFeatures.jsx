import React from 'react';
import { motion } from 'framer-motion';
import { Route, Map, WifiOff, Navigation, MapPin, ShieldAlert, QrCode, Accessibility, Globe, Cloud, Zap, Link } from 'lucide-react';

const ProductFeatures = () => {
  const features = [
    {
      icon: Route,
      title: 'Private Pedestrian Routing',
      description: 'Custom routing algorithms optimized for walking paths, not vehicle roads'
    },
    {
      icon: Map,
      title: 'Unified Indoor + Outdoor Navigation',
      description: 'Seamless transitions between indoor floor plans and outdoor maps'
    },
    {
      icon: WifiOff,
      title: 'Offline-First PWA',
      description: 'Progressive Web App that works without internet connectivity'
    },
    {
      icon: Navigation,
      title: 'GPS Navigation Without Internet',
      description: 'Real-time positioning and turn-by-turn directions offline'
    },
    {
      icon: MapPin,
      title: 'Custom POIs',
      description: 'Define and manage unlimited points of interest specific to your venue'
    },
    {
      icon: ShieldAlert,
      title: 'Restricted Zones & One-Way Paths',
      description: 'Enforce access control and directional flow through navigation logic'
    },
    {
      icon: QrCode,
      title: 'QR-Based Access',
      description: 'Quick access to navigation via QR codes placed throughout the venue'
    },
    {
      icon: Accessibility,
      title: 'Accessibility-Aware Routes',
      description: 'Wheelchair-friendly and mobility-accessible path calculations'
    },
    {
      icon: Globe,
      title: 'Multilingual Support',
      description: 'Interface and content available in multiple languages'
    },
    {
      icon: Cloud,
      title: 'Cloud or On-Premise Deployment',
      description: 'Flexible hosting options to meet your security and compliance needs'
    },
    {
      icon: Zap,
      title: 'High-Concurrency Architecture',
      description: 'Handles thousands of simultaneous users without performance degradation'
    },
    {
      icon: Link,
      title: 'Integration-Ready',
      description: 'APIs and webhooks for seamless integration with existing systems'
    }
  ];

  return (
    <section id="features" className="py-16 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold mb-6" style={{ color: '#2D5016' }}>
            Product Features
          </h2>
          <p className="text-xl text-gray-700 max-w-3xl mx-auto">
            Comprehensive capabilities designed for enterprise wayfinding needs
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              whileHover={{ y: -5 }}
              className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-all"
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: '#E3F2FD' }}
                >
                  <feature.icon className="w-6 h-6" style={{ color: '#1E5A96' }} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2" style={{ color: '#2D5016' }}>
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProductFeatures;