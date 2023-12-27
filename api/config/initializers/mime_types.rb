Mime::Type.unregister :json
Mime::Type.register 'application/json', :json, %w(
  application/vnd.api+json
  text/x-json
  application/json
)
