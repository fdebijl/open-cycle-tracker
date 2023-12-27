class ApplicationController < ActionController::API
  include Pundit::Authorization

  before_action :authenticate_user!
  before_action :verify_permitted_attributes, only: :filter
  after_action :verify_policy_scoped, except: :create
  after_action :verify_authorized

  protected

  def resource_class(controller = params[:controller])
    if controller.singularize.camelize.safe_constantize.present?
      controller.singularize.camelize.safe_constantize
    elsif controller.include? '/'
      resource_class(controller.partition('/').last)
    end
  end

  def permitted_attributes(record, action = params[:action], policy_class: nil)
    policy = policy_class ? policy_class.new(current_user, record) : policy(record)

    method_name = if policy.respond_to?("permitted_attributes_for_#{action}")
      "permitted_attributes_for_#{action}"
    else
      'permitted_attributes'
    end

    if action.to_sym == :filter
      transform(params.require(:filter).permit(*policy.public_send(method_name)))
    else
      ActiveModelSerializers::Deserialization.jsonapi_parse(params, only: policy.public_send(method_name) || [])
    end
  end

  def transform(params)
    params.transform_values { |value| to_list value }
  end

  def to_list(value)
    if value.respond_to?(:transform_values)
      transform(value)
    elsif value.respond_to?(:split)
      value.split(',')
    else
      raise "Invalid argument type #{value.class}"
    end
  end

  def permitted_attributes?
    !permitted_attributes(resource_class).empty?
  end

  def verify_permitted_attributes
    head(:forbidden) unless permitted_attributes?
  end
end
