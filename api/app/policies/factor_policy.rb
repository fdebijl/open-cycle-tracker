class FactorPolicy < ApplicationPolicy
  def permitted_attributes
    super + [:notes]
  end

  def permitted_attributes_for_filter
    super
  end
end
