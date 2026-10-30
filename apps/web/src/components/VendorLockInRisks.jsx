import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, TrendingUp, Lock, AlertCircle, XCircle } from 'lucide-react';

const VendorLockInRisks = () => {
  const risks = [
    {
      icon: Lock,
      risk: 'Proprietary Formats',
      problem: 'Data locked in vendor-specific formats, making migration expensive or impossible',
      margSolution: 'Open GeoJSON standard ensures data portability and vendor independence'
    },
    {
      icon: AlertCircle,
      risk: 'Mandatory Updates',
      problem: 'Forced upgrades with breaking changes, disrupting operations and requiring retraining',
      margSolution: 'You control update timing and can maintain stable versions indefinitely'
    },
    {
      icon: TrendingUp,
      risk: 'Escalating Costs',
      problem: 'Per-user or per-transaction pricing that grows unpredictably with usage',
      margSolution: 'Fixed licensing with predictable annual support costs, no usage-based fees'
    },
    {
      icon: AlertTriangle,
      risk: 'Vendor Dependency',
      problem: 'Critical operations dependent on vendor availability, support, and business continuity',
      margSolution: 'On-premise deployment and optional source code escrow eliminate dependency'
    },
    {
      icon: XCircle,
      risk: 'Limited Exit Options',
      problem: 'High switching costs and data migration challenges trap organizations in unsuitable solutions',
      margSolution: 'Standard formats and customer-owned data enable seamless transitions if needed'
    }
  ];

  return (
    <section className="py-16 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl sm:text-5xl font-bold mb-6" style={{ color: '#2D5016' }}>
            Vendor Lock-In Risk — Key Consideration
          </h2>
          <p className="text-xl text-gray-700 max-w-3xl mx-auto mb-8">
            Understanding the risks of typical wayfinding solutions and how MARG addresses them
          </p>
          <img
            src="../../compare.JPG"
            alt="Diagram illustrating vendor lock-in risks and MARG mitigation strategies"
            className="max-w-2xl mx-auto rounded-xl shadow-2xl"
          />
        </motion.div>

        <div className="space-y-6 mt-12">
          {risks.map((item, index) => (
            <motion.div
              key={item.risk}
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-white rounded-xl shadow-lg overflow-hidden"
            >
              <div className="grid md:grid-cols-2 gap-6 p-6">
                <div className="flex gap-4">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: '#FFEBEE' }}
                  >
                    <item.icon className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold mb-2 text-red-700">
                      {item.risk}
                    </h3>
                    <p className="text-gray-700 leading-relaxed">
                      {item.problem}
                    </p>
                  </div>
                </div>
                <div className="bg-green-50 rounded-lg p-4" style={{ borderLeft: '4px solid #4A7C3C' }}>
                  <h4 className="font-semibold mb-2" style={{ color: '#2D5016' }}>
                    MARG Solution
                  </h4>
                  <p className="text-gray-700 leading-relaxed">
                    {item.margSolution}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-12 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-8 text-center"
        >
          <h3 className="text-2xl font-bold mb-4" style={{ color: '#1E5A96' }}>
            Long-Term Strategic Advantage
          </h3>
          <p className="text-lg text-gray-700 max-w-3xl mx-auto">
            MARG is architected to protect your investment and operational independence. You're not just buying software—you're securing long-term control over a critical infrastructure component.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default VendorLockInRisks;