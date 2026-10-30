import React from 'react';
import { motion } from 'framer-motion';
import { Check, X, Minus } from 'lucide-react';

const ComparisonTable = () => {
  const dimensions = [
    {
      dimension: 'Core Purpose',
      marg: 'Enterprise wayfinding for public venues',
      google: 'Consumer navigation for roads',
      traditional: 'Hardware-dependent signage'
    },
    {
      dimension: 'Internet Dependency',
      marg: 'Fully offline-capable',
      google: 'Requires constant connectivity',
      traditional: 'No internet needed (static)'
    },
    {
      dimension: 'Emergency Routing',
      marg: 'Dynamic evacuation & restricted zones',
      google: 'No emergency features',
      traditional: 'Manual signage updates'
    },
    {
      dimension: 'Indoor Accuracy',
      marg: 'Precise floor-level navigation',
      google: 'Limited indoor support',
      traditional: 'Static maps only'
    },
    {
      dimension: 'Hardware Dependency',
      marg: 'Software-only (PWA)',
      google: 'Software-only',
      traditional: 'Requires physical infrastructure'
    },
    {
      dimension: 'Customization Control',
      marg: 'Full control over POIs & routes',
      google: 'No customization',
      traditional: 'Vendor-dependent updates'
    },
    {
      dimension: 'Data Ownership',
      marg: 'Customer owns all data',
      google: 'Top vendor owns data',
      traditional: 'Vendor owns configuration'
    },
    {
      dimension: 'On-Prem Deployment',
      marg: 'Supported',
      google: 'Cloud-only',
      traditional: 'On-site hardware'
    },
    {
      dimension: 'Security & Compliance',
      marg: 'Enterprise-grade, customizable',
      google: 'Consumer-grade',
      traditional: 'Physical security only'
    },
    {
      dimension: 'Cost Structure',
      marg: 'One-time license + annual support',
      google: 'Free (data monetization)',
      traditional: 'High upfront + maintenance'
    },
    {
      dimension: 'Multi-Venue Scalability',
      marg: 'Unlimited venues',
      google: 'Not designed for venues',
      traditional: 'Per-venue hardware costs'
    },
    {
      dimension: 'Long-Term Flexibility',
      marg: 'No vendor lock-in',
      google: 'Locked to Top vendor ecosystem',
      traditional: 'Locked to vendor hardware'
    }
  ];

  const getIcon = (value) => {
    if (value.toLowerCase().includes('no ') || value.toLowerCase().includes('limited')) {
      return <X className="w-5 h-5 text-red-500" />;
    }
    if (value.toLowerCase().includes('supported') || value.toLowerCase().includes('full') || value.toLowerCase().includes('unlimited')) {
      return <Check className="w-5 h-5 text-green-600" />;
    }
    return <Minus className="w-5 h-5 text-gray-400" />;
  };

  return (
    <section id="comparison" className="py-16 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl sm:text-5xl font-bold mb-6" style={{ color: '#2D5016' }}>
            How MARG Compares
          </h2>
          <p className="text-xl text-gray-700 max-w-3xl mx-auto mb-8">
            MARG vs Top vendor Maps vs Traditional Wayfinding Vendors
          </p>
          <img
            src="../../arch.JPG"
            alt="Comparison chart showing MARG advantages over Top vendor Maps and traditional wayfinding solutions"
            className="max-w-2xl mx-auto rounded-xl shadow-2xl mb-8"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="overflow-x-auto"
        >
          <div className="inline-block min-w-full align-middle">
            <div className="overflow-hidden shadow-xl rounded-xl">
              <table className="min-w-full divide-y divide-gray-200">
                <thead style={{ backgroundColor: '#2D5016' }}>
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider">
                      Dimension
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider">
                      MARG
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider">
                      Top vendor Maps
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-white uppercase tracking-wider">
                      Traditional Vendors
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {dimensions.map((row, index) => (
                    <motion.tr
                      key={row.dimension}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {row.dimension}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <div className="flex items-center gap-2">
                          {getIcon(row.marg)}
                          <span className="font-medium">{row.marg}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <div className="flex items-center gap-2">
                          {getIcon(row.google)}
                          <span>{row.google}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <div className="flex items-center gap-2">
                          {getIcon(row.traditional)}
                          <span>{row.traditional}</span>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default ComparisonTable;