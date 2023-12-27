class DayPolicy < ApplicationPolicy
  def permitted_attributes
    super + [:order, :date, :day_type, :cycle]
  end

  def permitted_attributes_for_filter
    super
  end
end
