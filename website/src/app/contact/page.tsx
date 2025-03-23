"use client";

import { useState } from 'react';
import Link from 'next/link';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    subject: '',
    message: '',
  });

  const [formStatus, setFormStatus] = useState<{
    status: 'idle' | 'submitting' | 'success' | 'error';
    message?: string;
  }>({
    status: 'idle',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setFormStatus({ status: 'submitting' });
    
    try {
      // In a real implementation, this would submit to a Netlify function
      // For now, we'll simulate a successful submission with a timeout
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setFormStatus({
        status: 'success',
        message: 'Your message has been sent! We\'ll get back to you as soon as possible.',
      });
      
      // Reset the form
      setFormData({
        name: '',
        email: '',
        company: '',
        subject: '',
        message: '',
      });
    } catch (error) {
      setFormStatus({
        status: 'error',
        message: 'There was an error sending your message. Please try again later.',
      });
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Hero Section */}
      <section className="pt-20 pb-16 bg-gradient-to-r from-secondary to-secondary/90 text-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            <span className="text-primary">Contact</span> Us
          </h1>
          <p className="text-lg md:text-xl mb-8 text-gray-200 max-w-3xl mx-auto">
            Have questions about the Neo N3 Service Layer? We're here to help. Get in touch with our team.
          </p>
        </div>
      </section>

      {/* Contact Form Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row gap-12">
            {/* Contact Details */}
            <div className="md:w-1/3">
              <div className="bg-white rounded-lg shadow-md p-8">
                <h2 className="text-2xl font-bold mb-6">Get In Touch</h2>
                
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Email</h3>
                    <p className="text-gray-600">
                      <a 
                        href="mailto:contact@r3e-network.io" 
                        className="text-primary hover:underline"
                      >
                        contact@r3e-network.io
                      </a>
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Community</h3>
                    <p className="text-gray-600 mb-1">
                      Join our Discord:
                      <a 
                        href="https://discord.gg/r3e-network" 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline ml-1"
                      >
                        discord.gg/r3e-network
                      </a>
                    </p>
                    <p className="text-gray-600">
                      Follow us on Twitter:
                      <a 
                        href="https://twitter.com/r3enetwork" 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline ml-1"
                      >
                        @r3enetwork
                      </a>
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold mb-2">GitHub</h3>
                    <p className="text-gray-600">
                      <a 
                        href="https://github.com/R3E-Network/service_layer" 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        github.com/R3E-Network/service_layer
                      </a>
                    </p>
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-gray-200">
                  <h3 className="text-lg font-semibold mb-4">Looking for help?</h3>
                  <p className="text-gray-600 mb-4">
                    Check out our documentation for guides and API references.
                  </p>
                  <Link 
                    href="/docs" 
                    className="btn btn-primary"
                  >
                    View Documentation
                  </Link>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="md:w-2/3">
              <div className="bg-white rounded-lg shadow-md p-8">
                <h2 className="text-2xl font-bold mb-6">Send us a message</h2>
                
                {formStatus.status === 'success' ? (
                  <div className="bg-green-50 border-l-4 border-green-500 p-6 rounded-lg">
                    <h3 className="text-xl font-semibold text-green-800 mb-2">
                      Thank You!
                    </h3>
                    <p className="text-green-700">
                      {formStatus.message}
                    </p>
                    <button
                      className="mt-4 btn bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => setFormStatus({ status: 'idle' })}
                    >
                      Send Another Message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                          Your Name*
                        </label>
                        <input
                          type="text"
                          id="name"
                          name="name"
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                          value={formData.name}
                          onChange={handleChange}
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                          Your Email*
                        </label>
                        <input
                          type="email"
                          id="email"
                          name="email"
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                          value={formData.email}
                          onChange={handleChange}
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div>
                        <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">
                          Company
                        </label>
                        <input
                          type="text"
                          id="company"
                          name="company"
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                          value={formData.company}
                          onChange={handleChange}
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
                          Subject*
                        </label>
                        <select
                          id="subject"
                          name="subject"
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                          value={formData.subject}
                          onChange={handleChange}
                        >
                          <option value="">Select a topic</option>
                          <option value="General Inquiry">General Inquiry</option>
                          <option value="Technical Support">Technical Support</option>
                          <option value="Partnership">Partnership</option>
                          <option value="Enterprise Solutions">Enterprise Solutions</option>
                          <option value="Feedback">Feedback</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="mb-6">
                      <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                        Your Message*
                      </label>
                      <textarea
                        id="message"
                        name="message"
                        rows={6}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                        value={formData.message}
                        onChange={handleChange}
                      ></textarea>
                    </div>
                    
                    {formStatus.status === 'error' && (
                      <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg mb-6">
                        <p className="text-red-700">
                          {formStatus.message}
                        </p>
                      </div>
                    )}
                    
                    <div className="text-right">
                      <button
                        type="submit"
                        disabled={formStatus.status === 'submitting'}
                        className={`btn btn-primary ${
                          formStatus.status === 'submitting' ? 'opacity-75 cursor-not-allowed' : ''
                        }`}
                      >
                        {formStatus.status === 'submitting' ? 'Sending...' : 'Send Message'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-12 text-center">
            Frequently Asked Questions
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-bold mb-3">What is the Neo N3 Service Layer?</h3>
              <p className="text-gray-600">
                The Neo N3 Service Layer is a centralized oracle service for the Neo N3 blockchain, providing secure JavaScript functions execution in TEE, contract automation, price feeds, and more.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-bold mb-3">How secure is the Service Layer?</h3>
              <p className="text-gray-600">
                The Service Layer uses Azure Confidential Computing for Trusted Execution Environment (TEE) capabilities, providing high-security guarantees for code execution and data confidentiality.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-bold mb-3">Can I try the Service Layer before integrating?</h3>
              <p className="text-gray-600">
                Yes! You can use our interactive playground to experiment with the JavaScript functions service and get familiar with the capabilities before integrating with your applications.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-bold mb-3">How do I get started?</h3>
              <p className="text-gray-600">
                Check out our <Link href="/docs/getting-started" className="text-primary hover:underline">Getting Started guide</Link> in the documentation, or contact us for personalized assistance with your integration.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}