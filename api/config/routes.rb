Rails.application.routes.draw do
  # Authentication
  devise_for :users, path: '', path_names: {
    sign_in: 'login',
    sign_out: 'logout',
    registration: 'signup'
  },
  controllers: {
    sessions: 'users/sessions',
    registrations: 'users/registrations'
  }

  # Resources
  [:cycles, :days].each do |resource|
    resources resource do
      get :filter, on: :collection, path: '', constraints: ->(request) { request.params.key? :filter }
    end
  end

  # Might not be needed
  # root to: redirect { Rails.application.config.app[:ui_url] }
end

