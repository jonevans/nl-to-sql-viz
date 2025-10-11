'use client';

import { useState } from 'react';

interface PocTermsModalProps {
  onAccept: () => void;
  onDecline: () => void;
  userName?: string;
}

export default function PocTermsModal({ onAccept, onDecline, userName }: PocTermsModalProps) {
  const [agreed, setAgreed] = useState(false);

  const handleDecline = () => {
    // Redirect to Impact Networking website
    window.location.href = 'https://impactnetworking.com';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#2D7D32] to-[#1B5E20] text-white p-6 rounded-t-lg">
          <h2 className="text-2xl font-bold">Proof of Concept Agreement</h2>
          <p className="text-sm mt-1 text-green-100">Colony Hardware Sales Advisor Demo System</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {userName && (
            <p className="text-gray-700">
              Welcome, <span className="font-semibold">{userName}</span>!
            </p>
          )}

          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700 font-semibold">
                  This is a demonstration system for evaluation purposes only
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 text-gray-700">
            <h3 className="font-semibold text-lg text-gray-900">Important Information:</h3>

            <div className="space-y-2 text-sm">
              <div className="flex items-start">
                <span className="text-[#2D7D32] mr-2">•</span>
                <p><strong>Purpose:</strong> This system is a Proof of Concept (POC) to demonstrate natural language to SQL capabilities for Colony Hardware.</p>
              </div>

              <div className="flex items-start">
                <span className="text-[#2D7D32] mr-2">•</span>
                <p><strong>Data:</strong> This system contains Colony Hardware sales data from calendar year 2023 only. All customer and product information has been anonymized for security and privacy purposes.</p>
              </div>

              <div className="flex items-start">
                <span className="text-[#2D7D32] mr-2">•</span>
                <p><strong>Availability:</strong> This demonstration system will be available until <strong>November 15, 2025</strong>. Access will be terminated after this date.</p>
              </div>

              <div className="flex items-start">
                <span className="text-[#2D7D32] mr-2">•</span>
                <p><strong>Beta Software:</strong> This is pre-release software and may behave unexpectedly. Results should be verified before making business decisions. Not all features may work as intended.</p>
              </div>

              <div className="flex items-start">
                <span className="text-[#2D7D32] mr-2">•</span>
                <p><strong>No Warranty:</strong> This system is provided "as is" without warranties of any kind. Impact Networking and its affiliates are not responsible for any decisions made based on information provided by this system.</p>
              </div>

              <div className="flex items-start">
                <span className="text-[#2D7D32] mr-2">•</span>
                <p><strong>Data Usage:</strong> Usage data and queries may be collected for system improvement purposes. Do not enter any confidential or proprietary information.</p>
              </div>

              <div className="flex items-start">
                <span className="text-[#2D7D32] mr-2">•</span>
                <p><strong>Evaluation Only:</strong> This system is for evaluation purposes to determine if a production version would meet Colony Hardware's needs.</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded p-4 mt-4">
            <p className="text-xs text-gray-600 italic">
              By clicking "I Accept," you acknowledge that you have read and understood these terms and agree to use this system in accordance with them. If you do not agree, please click "Decline" to exit.
            </p>
          </div>

          {/* Checkbox */}
          <div className="flex items-start pt-2">
            <div className="flex items-center h-5">
              <input
                id="agree-checkbox"
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="w-4 h-4 text-[#2D7D32] border-gray-300 rounded focus:ring-[#2D7D32]"
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="agree-checkbox" className="font-medium text-gray-700">
                I have read and agree to the terms of this Proof of Concept demonstration
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-lg flex justify-end space-x-3">
          <button
            onClick={handleDecline}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Decline
          </button>
          <button
            onClick={onAccept}
            disabled={!agreed}
            className={`px-6 py-2 rounded-md text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2D7D32] ${
              agreed
                ? 'bg-[#2D7D32] hover:bg-[#1B5E20]'
                : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            I Accept
          </button>
        </div>

        {/* Powered by */}
        <div className="px-6 pb-4 text-center">
          <p className="text-xs text-gray-500">
            Powered by Impact Networking • Questions? Contact your Impact Networking representative
          </p>
        </div>
      </div>
    </div>
  );
}
