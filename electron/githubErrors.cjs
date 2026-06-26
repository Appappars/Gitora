function githubErrorMessage(status, message, endpoint = '', method = 'GET') {
  if (status === 403 && method === 'DELETE' && endpoint.startsWith('/repos/')) {
    return 'Удаление репозитория запрещено GitHub. Проверьте, что токен имеет право delete_repo и что у аккаунта есть admin-доступ к репозиторию.';
  }
  return message || `GitHub API: ${status}`;
}

module.exports = { githubErrorMessage };
