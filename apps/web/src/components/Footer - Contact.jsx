import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, Send, Loader2 } from 'lucide-react';
import { useToast } from './ui/use-toast';
import apiServerClient from './lib/apiServerClient';

const Footer = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    organization: '',
    message: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.name || !formData.email || !formData.organization || !formData.message) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      
      const response = await apiServerClient.fetch('/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });
      

      const data = await response.json();

      if (!response.ok || (data && data.success === false)) {
        throw new Error(data.error || 'Failed to send message');
      }

      toast({
        title: "Message Sent!",
        description: "Thank you for contacting us. We will get back to you shortly.",
        className: "bg-green-600 text-white border-none"
      });

      setFormData({
        name: '',
        email: '',
        organization: '',
        message: ''
      });
    } catch (error) {
      console.error('Contact submission error:', error);
      toast({
        title: "Submission Failed",
        description: error.message || "There was a problem sending your message. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <footer id="contact" className="bg-gradient-to-b from-gray-900 to-black text-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-12">
          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h3 className="text-3xl font-bold mb-6" style={{ color: '#D4A574' }}>
              Request a Demo
            </h3>
            <p className="text-gray-300 mb-6">
              Interested in learning more about MARG? Fill out the form below and our team will get in touch with you.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-2 text-gray-300">
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  disabled={isSubmitting}
                  className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-2 text-gray-300">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={isSubmitting}
                  className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="your.email@example.com"
                />
              </div>
              <div>
                <label htmlFor="organization" className="block text-sm font-medium mb-2 text-gray-300">
                  Organization
                </label>
                <input
                  type="text"
                  id="organization"
                  name="organization"
                  value={formData.organization}
                  onChange={handleChange}
                  required
                  disabled={isSubmitting}
                  className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Your organization"
                />
              </div>
              <div>
                <label htmlFor="message" className="block text-sm font-medium mb-2 text-gray-300">
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  rows={4}
                  required
                  disabled={isSubmitting}
                  className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Tell us about your wayfinding needs..."
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-6 py-3 rounded-lg font-semibold text-white flex items-center justify-center gap-2 hover:shadow-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#1E5A96' }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Send Message
                  </>
                )}
              </button>
            </form>
          </motion.div>

          {/* Company Info & Links */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
            <div>
              <h3 className="text-3xl font-bold mb-6" style={{ color: '#D4A574' }}>
                MARG
              </h3>
              <p className="text-gray-300 mb-6">
                Enterprise-grade offline-first wayfinding platform for public infrastructure, large venues, and government deployments.
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="text-xl font-semibold mb-4" style={{ color: '#4A7C3C' }}>
                Contact Information
              </h4>
              <div className="flex items-start gap-3 text-gray-300">
                <Mail className="w-5 h-5 mt-1 flex-shrink-0" style={{ color: '#3B82F6' }} />
                <div>
                  <p className="font-medium">Email</p>
                  <p>ajit.talekar@s9v.in</p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-gray-300">
                <Phone className="w-5 h-5 mt-1 flex-shrink-0" style={{ color: '#3B82F6' }} />
                <div>
                  <p className="font-medium">Phone</p>
                  <p>+91 9869101010</p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-gray-300">
                <MapPin className="w-5 h-5 mt-1 flex-shrink-0" style={{ color: '#3B82F6' }} />
                <div>
                  <p className="font-medium">Address</p>
                  <p>3404, Daffodils, Runwal Bliss, KanjurMarg, Mumbai-400042</p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xl font-semibold mb-4" style={{ color: '#4A7C3C' }}>
                Resources
              </h4>
              <ul className="space-y-2 text-gray-300">
                <li>
                  <a href="#features" className="hover:text-blue-400 transition-colors">
                    Product Features
                  </a>
                </li>
                <li>
                  <a href="#industries" className="hover:text-blue-400 transition-colors">
                    Target Industries
                  </a>
                </li>
                <li>
                  <a href="#comparison" className="hover:text-blue-400 transition-colors">
                    Comparison Guide
                  </a>
                </li>
                <li>
                  <a href="#deployment" className="hover:text-blue-400 transition-colors">
                    Deployment Options
                  </a>
                </li>
              </ul>
            </div>
          </motion.div>
        </div>

        <div className="border-t border-gray-800 pt-8 text-center text-gray-400">
          <p>&copy; {new Date().getFullYear()} MARG Platform. All rights reserved.</p>
          <p className="mt-2 text-sm">
            Reliable Navigation, Absolute Control
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;