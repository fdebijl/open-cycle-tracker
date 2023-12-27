class ApplicationPolicy
  attr_reader :user, :record

  def initialize(user, record)
    raise Pundit::NotAuthorizedError, "must be logged in" unless user

    @user = user
    @record = record
  end

  def resource_name
    self.class.name.remove('Policy').underscore.gsub('/', '.')
  end

  def readable?(resource_name = self.resource_name)
    if record.respond_to?(:each)
      record.all? { |rec| rec.user == user }
    else
      record.user == user
    end
  end

  def writeable?(resource_name = self.resource_name)
    if record.respond_to?(:each)
      record.all? { |rec| rec.user == user }
    else
      record.user == user
    end
  end

  def index?
    readable?
  end

  def filter?
    readable?
  end

  def show?
    readable?
  end

  def create?
    writeable?
  end

  def update?
    writeable?
  end

  def destroy?
    writeable?
  end

  def permitted_attributes
    [:id]
  end

  def permitted_attributes_for_filter
    [:id]
  end

  class Scope
    def initialize(user, scope)
      raise Pundit::NotAuthorizedError, "must be logged in" unless user

      @user = user
      @scope = scope
    end

    def resolve
      scope.where(user: user)
    end

    private

    attr_reader :user, :scope
  end
end
