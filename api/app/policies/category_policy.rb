class CategoryPolicy < ApplicationPolicy
  def writeable?
    if record.respond_to?(:each)
      record.all? { |rec| rec.user == user || (user.admin? && rec.global?) }
    else
      record.user == user || (user.admin? && record.global?)
    end
  end

  def readable?
    if record.respond_to?(:each)
      record.all? { |rec| rec.user == user || rec.global? }
    else
      record.user == user || record.global?
    end
  end

  def index?
    readable?
  end

  def permitted_attributes
    super + [:icon, :name, :color, :global]
  end

  def permitted_attributes_for_filter
    super
  end

  class Scope
    def initialize(user, scope)
      raise Pundit::NotAuthorizedError, "must be logged in" unless user

      @user = user
      @scope = scope
    end

    def resolve
      scope.where(user: user).or(scope.where(global: true))
    end

    private

    attr_reader :user, :scope
  end
end
