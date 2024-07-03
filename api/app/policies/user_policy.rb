# For now you can only read and write your own user record
# Might be extended down the line to allow admins to adjust other users
class UserPolicy < ApplicationPolicy
  def readable?
    record == user
  end

  def writeable?
    record == user
  end

  def permitted_attributes
    super + %i[name email info settings]
  end

  def permitted_attributes_for_filter
    super
  end

  class Scope < Scope
    def resolve
      scope.where(id: user.id)
    end
  end
end
