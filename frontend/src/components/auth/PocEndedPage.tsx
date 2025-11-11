'use client';

import React from 'react';

export const PocEndedPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="flex justify-center">
          <img
            src="/colony_logo.png"
            alt="Colony Hardware"
            className="h-16 w-auto"
          />
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
          Sales Advisor
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-white py-12 px-8 shadow-lg sm:rounded-lg border border-gray-200">
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="rounded-full bg-blue-100 p-3">
                <svg
                  className="h-12 w-12 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-bold text-gray-900">
                Proof of Concept Period Has Ended
              </h3>
            </div>

            <div className="space-y-4 text-gray-600">
              <p className="text-lg">
                Thank you for participating in the Sales Advisor pilot program.
              </p>
              <p>
                This proof of concept phase has concluded. Your feedback has been invaluable
                in shaping the future of this platform.
              </p>
              <p className="text-lg font-medium text-gray-900">
                Stay tuned for updates on the full release.
              </p>
              <p>
                For questions, please contact your Colony Hardware representative.
              </p>
            </div>

            <div className="pt-6">
              <a
                href="https://impactnetworking.com"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-[#2D7D32] hover:bg-[#246428] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2D7D32] transition-colors"
              >
                Visit Impact Networking
              </a>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-gray-200">
            <div className="text-center text-sm text-gray-500">
              <p>Colony Hardware - A Division of Impact Networking</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
