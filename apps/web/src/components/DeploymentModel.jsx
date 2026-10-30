import React from 'react';
import { motion } from 'framer-motion';
import { Smartphone, Server, FileCheck, Navigation, Map, Database, Shield } from 'lucide-react';

const DeploymentModel = () => {
  const deploymentOptions = [
    {
      icon: Smartphone,
      title: 'Progressive Web Application (PWA)',
      description: 'No app store required. Visitors access via browser with offline capabilities and home screen installation.'
    },
    {
      icon: Server,
      title: 'On-Premise or Authority-Approved Hosting',
      description: 'Deploy on your infrastructure or government-approved cloud providers for complete data sovereignty.'
    },
    {
      icon: FileCheck,
      title: 'Licensed Deployment with Annual Maintenance & Support',
      description: 'One-time license fee with predictable annual support costs. Includes updates, security patches, and technical assistance.'
    }
  ];

  const architecture = [
    {
      icon: Navigation,
      title: 'Client-Side Routing & GPS',
      description: 'All navigation logic runs on the user\'s device, ensuring privacy and offline functionality.'
    },
    {
      icon: Map,
      title: 'Offline Maps & Routes',
      description: 'Complete map data and routing algorithms cached locally for zero-latency navigation.'
    },
    {
      icon: Database,
      title: 'Stateless Server Tier',
      description: 'Minimal server requirements for configuration updates and analytics—no real-time dependencies.'
    },
    {
      icon: Shield,
      title: 'No GPS Data Streaming',
      description: 'User location never leaves their device, ensuring privacy and reducing server load.'
    }
  ];

  return (
    <section id="deployment" className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold mb-6" style={{ color: '#2D5016' }}>
            Deployment Model
          </h2>
          <p className="text-xl text-gray-700 max-w-3xl mx-auto">
            Flexible deployment options designed for enterprise and government requirements
          </p>
        </motion.div>

        <div className="mb-16">
          <h3 className="text-2xl font-semibold text-center mb-8" style={{ color: '#1E5A96' }}>
            Deployment Options
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {deploymentOptions.map((option, index) => (
              <motion.div
                key={option.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ y: -5 }}
                className="bg-gradient-to-br from-white to-gray-50 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all"
                style={{ borderTop: '4px solid #4A7C3C' }}
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
                  style={{ backgroundColor: '#E8F5E9' }}
                >
                  <option.icon className="w-7 h-7" style={{ color: '#2D5016' }} />
                </div>
                <h3 className="text-lg font-bold mb-3" style={{ color: '#1E5A96' }}>
                  {option.title}
                </h3>
                <p className="text-gray-700 leading-relaxed">
                  {option.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <h3 className="text-2xl font-semibold text-center mb-8" style={{ color: '#1E5A96' }}>
            Technical Architecture
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {architecture.map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-all"
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: '#E3F2FD' }}
                  >
                    <item.icon className="w-6 h-6" style={{ color: '#1E5A96' }} />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold mb-2" style={{ color: '#2D5016' }}>
                      {item.title}
                    </h4>
                    <p className="text-gray-700 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-12 bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-8"
        >
          <h3 className="text-2xl font-bold mb-4 text-center" style={{ color: '#1E5A96' }}>
            Scalable & Secure by Design
          </h3>
          <p className="text-lg text-gray-700 text-center max-w-3xl mx-auto">
            MARG's architecture minimizes server dependencies while maximizing performance, privacy, and reliability. The stateless design enables horizontal scaling to support thousands of concurrent users without infrastructure complexity.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default DeploymentModel;