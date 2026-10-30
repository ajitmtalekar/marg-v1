import React from 'react';
import { motion } from 'framer-motion';
import { Database, FileJson, Settings, Server, Lock, DollarSign } from 'lucide-react';

const LockInMitigation = () => {
  const features = [
    {
      icon: Database,
      title: 'Customer-Owned Data',
      description: 'All venue data, maps, and configurations belong to you. Export anytime in standard formats.'
    },
    {
      icon: FileJson,
      title: 'Standards-Based GeoJSON',
      description: 'Maps and routes stored in open GeoJSON format, ensuring portability and interoperability.'
    },
    {
      icon: Settings,
      title: 'Config-Driven Logic',
      description: 'Navigation rules, POIs, and restrictions managed through configuration files you control.'
    },
    {
      icon: Server,
      title: 'On-Premise Deployment',
      description: 'Host on your own infrastructure with complete control over updates and maintenance.'
    },
    {
      icon: Lock,
      title: 'Optional Source-Code Escrow',
      description: 'Enterprise customers can access source code through escrow agreements for ultimate protection.'
    },
    {
      icon: DollarSign,
      title: 'No Per-User Licensing',
      description: 'One-time license fee with predictable annual support costs. No surprise charges as usage grows.'
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
            How MARG Prevents Vendor Lock-In
          </h2>
          <p className="text-xl text-gray-700 max-w-3xl mx-auto">
            Maintain operational control and data ownership throughout your deployment
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -5 }}
              className="bg-gradient-to-br from-white to-gray-50 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all"
              style={{ borderTop: '3px solid #1E5A96' }}
            >
              <div
                className="w-14 h-14 rounded-lg flex items-center justify-center mb-4"
                style={{ backgroundColor: '#E3F2FD' }}
              >
                <feature.icon className="w-7 h-7" style={{ color: '#1E5A96' }} />
              </div>
              <h3 className="text-lg font-bold mb-3" style={{ color: '#2D5016' }}>
                {feature.title}
              </h3>
              <p className="text-gray-700 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-12 bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-8 text-center"
        >
          <h3 className="text-2xl font-bold mb-4" style={{ color: '#1E5A96' }}>
            Your Infrastructure, Your Control
          </h3>
          <p className="text-lg text-gray-700 max-w-3xl mx-auto">
            MARG is designed to give you complete operational independence. You're not renting a service—you're licensing a platform that you control, customize, and own.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default LockInMitigation;