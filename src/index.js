function getProjectStatus() {
  return 'Project uploaded successfully';
}

if (require.main === module) {
  console.log(getProjectStatus());
}

module.exports = {
  getProjectStatus,
};
