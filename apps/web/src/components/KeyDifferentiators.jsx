import React from 'react';
import { motion } from 'framer-motion';
import { WifiOff, AlertTriangle, Users, Settings, Shield } from 'lucide-react';

const KeyDifferentiators = () => {
  const differentiators = [
    {
      icon: WifiOff,
      title: 'Offline-First Architecture',
      description: 'Fully functional without internet connectivity. Maps, routes, and POIs are cached locally, ensuring uninterrupted navigation even in areas with poor or no network coverage.'
    },
    {
      icon: AlertTriangle,
      title: 'Emergency-Aware Navigation',
      description: 'Dynamic route recalculation during emergencies. Supports evacuation protocols, restricted zone enforcement, and real-time path adjustments for public safety scenarios.'
    },
    {
      icon: Users,
      title: 'Public-Venue Ready',
      description: 'Purpose-built for high-traffic public spaces. Handles thousands of concurrent users, supports multilingual interfaces, and provides accessibility-aware routing for inclusive navigation.'
    },
    {
      icon: Settings,
      title: 'Configurable Platform',
      description: 'Complete control over navigation logic, POI management, and route restrictions. No vendor dependency for updates or customizations—your team owns the configuration.'
    },
    {
      icon: Shield,
      title: 'Government & Enterprise Aligned',
      description: 'Meets stringent security and compliance requirements. Supports on-premise deployment, data sovereignty, and integration with existing enterprise systems and authentication protocols.'
    }
  ];

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold mb-6" style={{ color: '#2D5016' }}>
            Key Differentiators
          </h2>
          <p className="text-xl text-gray-700 max-w-3xl mx-auto">
            What sets MARG apart from consumer navigation apps and traditional wayfinding solutions
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {differentiators.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ scale: 1.05, y: -10 }}
              className="bg-gradient-to-br from-white to-gray-50 rounded-xl p-8 shadow-lg hover:shadow-2xl transition-all"
              style={{ borderTop: '4px solid #4A7C3C' }}
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
                style={{ backgroundColor: '#E8F5E9' }}
              >
                <item.icon className="w-8 h-8" style={{ color: '#2D5016' }} />
              </div>
              <h3 className="text-xl font-bold mb-4" style={{ color: '#1E5A96' }}>
                {item.title}
              </h3>
              <p className="text-gray-700 leading-relaxed">
                {item.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default KeyDifferentiators;