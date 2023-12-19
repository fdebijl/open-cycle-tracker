# API only rails apps don't have sessions enabled by default, but Devise needs
# sessions to function. This is a workaround to get Devise working in an API-only rails app.
module RackSessionsFix
  extend ActiveSupport::Concern

  class FakeRackSession < Hash
    def enabled?
      false
    end
    def destroy; end
  end

  included do
    before_action :set_fake_session
    private
    def set_fake_session
      request.env['rack.session'] ||= FakeRackSession.new
    end
  end
end
