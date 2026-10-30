import React from 'react';
import { motion } from 'framer-motion';
import { Trees, FerrisWheel as Ferris, School, Hotel as Hospital, Plane, Theater as Museum, Factory, Calendar, Ship, Church, Shield } from 'lucide-react';

const TargetIndustries = () => {
  const industries = [
    {
      icon: Trees,
      title: 'Zoos & Safari Parks',
      description: 'Navigate vast outdoor spaces with animal exhibits, trails, and visitor amenities'
    },
    {
      icon: Ferris,
      title: 'Theme Parks',
      description: 'Guide visitors through attractions, shows, dining, and entertainment zones'
    },
    {
      icon: School,
      title: 'Large Campuses',
      description: 'University and corporate campuses with multiple buildings and facilities'
    },
    {
      icon: Hospital,
      title: 'Hospitals',
      description: 'Complex medical facilities with departments, wings, and emergency routes'
    },
    {
      icon: Plane,
      title: 'Airports & Metro',
      description: 'Transit hubs with terminals, gates, platforms, and transfer points'
    },
    {
      icon: Museum,
      title: 'Museums',
      description: 'Cultural institutions with galleries, exhibitions, and educational spaces'
    },
    {
      icon: Factory,
      title: 'Industrial Facilities',
      description: 'Manufacturing plants, warehouses, and logistics centers'
    },
    {
      icon: Calendar,
      title: 'Event Venues',
      description: 'Convention centers, stadiums, and large-scale event spaces'
    },
    {
      icon: Ship,
      title: 'Resorts & Cruise Ships',
      description: 'Hospitality venues with extensive grounds and multiple amenities'
    },
    {
      icon: Church,
      title: 'Religious & Heritage Sites',
      description: 'Temples, pilgrimage sites, and historical landmarks'
    },
    {
      icon: Shield,
      title: 'Defense & Government',
      description: 'Secure facilities requiring controlled access and emergency protocols'
    }
  ];

  return (
    <section id="industries" className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold mb-6" style={{ color: '#2D5016' }}>
            Target Industries
          </h2>
          <p className="text-xl text-gray-700 max-w-3xl mx-auto">
            Serving diverse sectors with specialized wayfinding needs
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {industries.map((industry, index) => (
            <motion.div
              key={industry.title}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              whileHover={{ scale: 1.03, y: -5 }}
              className="bg-gradient-to-br from-white to-gray-50 rounded-xl p-6 shadow-lg hover:shadow-2xl transition-all"
              style={{ borderLeft: '4px solid #D4A574' }}
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
                style={{ backgroundColor: '#FFF8E1' }}
              >
                <industry.icon className="w-7 h-7" style={{ color: '#8B7355' }} />
              </div>
              <h3 className="text-xl font-bold mb-3" style={{ color: '#1E5A96' }}>
                {industry.title}
              </h3>
              <p className="text-gray-700 leading-relaxed">
                {industry.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TargetIndustries;