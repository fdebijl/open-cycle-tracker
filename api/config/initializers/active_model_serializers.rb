ActiveModelSerializers.config.adapter = :json_api
ActiveModelSerializers.config.jsonapi_pagination_links_enabled = false

Oj::Rails.set_encoder
Oj::Rails.optimize
