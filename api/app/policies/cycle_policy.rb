class CyclePolicy < ApplicationPolicy
  def permitted_attributes
    super
  end

  def permitted_attributes_for_filter
    super + [:current]
  end
end
