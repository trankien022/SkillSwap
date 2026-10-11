module.exports = {
 async rewrites() {
  const gateway=(process.env.API_GATEWAY_URL || 'http://localhost:4000').replace(/\/$/,'');
  return [{source:'/backend/api/:path*',destination:`${gateway}/api/:path*`}];
 }
};
